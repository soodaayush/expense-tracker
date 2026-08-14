IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    user_id       UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    display_name  NVARCHAR(200)    NULL,
    created_at    DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.Bills', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Bills (
    id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    user_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Bills_Users REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    payee       NVARCHAR(400)    NOT NULL,
    amount      DECIMAL(12,2)    NULL,
    due_date    DATE             NOT NULL,
    paid_date   DATE             NULL,
    notes       NVARCHAR(MAX)    NOT NULL DEFAULT '',
    created_at  DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bills_UserId' AND object_id = OBJECT_ID('dbo.Bills'))
  CREATE INDEX IX_Bills_UserId ON dbo.Bills(user_id, due_date);
GO

IF OBJECT_ID('dbo.Payees', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Payees (
    user_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Payees_Users REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    name        NVARCHAR(400)    NOT NULL,
    created_at  DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Payees PRIMARY KEY (user_id, name)
  );
END
GO

-- Payees moves from being a denormalized name-only autocomplete list to the source of truth
-- for a payee's identity, so a rename can propagate to every bill that references it. The
-- steps below are all idempotent (guarded on current information_schema/sys.* state, not on
-- "did this run before"), matching this file's existing pattern, since it's re-run on every
-- `npm run db:migrate` against real data, not just fresh installs.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Payees') AND name = 'id')
  ALTER TABLE dbo.Payees ADD id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID();
GO

-- Swap the PK from (user_id, name) to id alone. Guarded on "is id already the PK" rather than
-- a constraint name, so a rerun after the swap is a no-op.
IF NOT EXISTS (
  SELECT 1 FROM sys.key_constraints kc
  JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
  JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
  WHERE kc.type = 'PK' AND kc.parent_object_id = OBJECT_ID('dbo.Payees') AND c.name = 'id'
)
BEGIN
  ALTER TABLE dbo.Payees DROP CONSTRAINT PK_Payees;
  ALTER TABLE dbo.Payees ADD CONSTRAINT PK_Payees PRIMARY KEY (id);
END
GO

-- Preserves the old per-user case-insensitive dedup guarantee the composite PK used to provide.
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_Payees_UserId_Name' AND type = 'UQ')
  ALTER TABLE dbo.Payees ADD CONSTRAINT UQ_Payees_UserId_Name UNIQUE (user_id, name);
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Bills') AND name = 'payee_id')
  ALTER TABLE dbo.Bills ADD payee_id UNIQUEIDENTIFIER NULL;
GO

-- Backfill: create any Payees rows missing for existing Bills.payee values. Scoped to
-- payee_id IS NULL, so once every bill is backfilled a rerun touches zero rows.
-- Wrapped in EXEC(N'...') rather than a plain IF/BEGIN/END: SQL Server compiles a whole batch
-- up front, including statements inside an untaken IF branch, and INSERT/UPDATE need every
-- column resolved against the table's *current* schema at compile time — so once a prior run
-- has dropped payee (below), a plain guarded INSERT here still fails to compile, IF or no IF.
-- Dynamic SQL defers parsing the column reference until the string actually executes, by which
-- point the IF has already gated whether that happens at all.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Bills') AND name = 'payee')
BEGIN
  EXEC(N'
    INSERT INTO dbo.Payees (id, user_id, name)
    SELECT NEWID(), x.user_id, x.payee
    FROM (SELECT DISTINCT user_id, payee FROM dbo.Bills WHERE payee_id IS NULL) x
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Payees p WHERE p.user_id = x.user_id AND p.name = x.payee);
  ');
END
GO

-- Backfill: point payee_id at the now-guaranteed-to-exist matching Payees row. Same
-- dynamic-SQL reason as above — b.payee stops resolving once the column is gone, and a plain
-- IF/BEGIN/END guard doesn't stop the batch from trying to compile it anyway.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Bills') AND name = 'payee')
BEGIN
  EXEC(N'
    UPDATE b
    SET b.payee_id = p.id
    FROM dbo.Bills b
    JOIN dbo.Payees p ON p.user_id = b.user_id AND p.name = b.payee
    WHERE b.payee_id IS NULL;
  ');
END
GO

-- Lock it down: NOT NULL, then the FK. If the backfill above somehow missed a row, this fails
-- loudly here instead of silently shipping a broken foreign key.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Bills') AND name = 'payee_id' AND is_nullable = 1)
  ALTER TABLE dbo.Bills ALTER COLUMN payee_id UNIQUEIDENTIFIER NOT NULL;
GO

-- NO ACTION, not CASCADE: Users already cascades to both Bills and Payees directly, and a
-- cascading Bills -> Payees FK on top of that creates the exact ambiguous multi-path scenario
-- SQL Server refuses to create (error 1785). NO ACTION also backstops the app-level
-- "block delete while a payee is still in use" rule with a real constraint (error 547).
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Bills_Payees')
  ALTER TABLE dbo.Bills ADD CONSTRAINT FK_Bills_Payees FOREIGN KEY (payee_id) REFERENCES dbo.Payees(id) ON DELETE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bills_PayeeId' AND object_id = OBJECT_ID('dbo.Bills'))
  CREATE INDEX IX_Bills_PayeeId ON dbo.Bills(payee_id);
GO

-- Bills.payee (the original NOT NULL text column) is now fully superseded by payee_id — every
-- read already goes through BILL_SELECT's JOIN on Payees, not this column, but it was still
-- NOT NULL so every insert/update was forced to keep writing a stale copy of the name into it.
-- Drop it now that payee_id is locked down as the sole source of truth.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Bills') AND name = 'payee')
  ALTER TABLE dbo.Bills DROP COLUMN payee;
GO

IF OBJECT_ID('dbo.PaymentMethods', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PaymentMethods (
    id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    user_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_PaymentMethods_Users REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    name        NVARCHAR(200)    NOT NULL,
    created_at  DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_PaymentMethods_UserId_Name UNIQUE (user_id, name)
  );
END
GO

-- Unlike Payees, this is a new optional field: existing bills carry no payment-method
-- information to backfill, so payment_method_id stays nullable and there's no legacy
-- denormalized text column to migrate off of.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Bills') AND name = 'payment_method_id')
  ALTER TABLE dbo.Bills ADD payment_method_id UNIQUEIDENTIFIER NULL;
GO

-- NO ACTION, not CASCADE, matching FK_Bills_Payees: Users already cascades to both Bills and
-- PaymentMethods directly, and a cascading Bills -> PaymentMethods FK on top of that creates the
-- same ambiguous multi-path scenario SQL Server refuses to create (error 1785).
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Bills_PaymentMethods')
  ALTER TABLE dbo.Bills ADD CONSTRAINT FK_Bills_PaymentMethods FOREIGN KEY (payment_method_id) REFERENCES dbo.PaymentMethods(id) ON DELETE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bills_PaymentMethodId' AND object_id = OBJECT_ID('dbo.Bills'))
  CREATE INDEX IX_Bills_PaymentMethodId ON dbo.Bills(payment_method_id);
GO

IF OBJECT_ID('dbo.Credentials', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Credentials (
    credential_id VARCHAR(500) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
    user_id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Credentials_Users REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    public_key    VARCHAR(1000)    NOT NULL,
    counter       INT              NOT NULL DEFAULT 0,
    transports    NVARCHAR(200)    NULL,
    device_label  NVARCHAR(200)    NOT NULL DEFAULT 'Unnamed device',
    created_at    DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Credentials_UserId' AND object_id = OBJECT_ID('dbo.Credentials'))
  CREATE INDEX IX_Credentials_UserId ON dbo.Credentials(user_id);
GO

-- Due-date reminder emails. One row per user (not a separate id) since it's a 1:1 settings
-- record; email stays NULL and enabled stays 0 until the user actually turns notifications on.
IF OBJECT_ID('dbo.NotificationPreferences', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.NotificationPreferences (
    user_id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_NotificationPreferences_Users REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    email                NVARCHAR(320)    NULL,
    enabled              BIT              NOT NULL DEFAULT 0,
    lead_days            INT              NOT NULL DEFAULT 3,
    send_hour            TINYINT          NOT NULL DEFAULT 9,
    send_minute          TINYINT          NOT NULL DEFAULT 0,
    -- IANA name (e.g. "America/Halifax"), not a fixed UTC offset, so the send time stays correct
    -- across Daylight Saving transitions without needing its own migration twice a year.
    time_zone            NVARCHAR(100)    NOT NULL DEFAULT 'America/Halifax',
    -- The last local calendar date (in time_zone) a digest check completed for this user — lets
    -- the every-15-minutes timer recognize "already handled today" without sending duplicates,
    -- regardless of which 15-minute tick actually lands inside the user's chosen send window.
    last_sent_local_date DATE             NULL,
    created_at           DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at           DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_NotificationPreferences PRIMARY KEY (user_id),
    CONSTRAINT CK_NotificationPreferences_LeadDays CHECK (lead_days >= 0 AND lead_days <= 90),
    CONSTRAINT CK_NotificationPreferences_SendHour CHECK (send_hour >= 0 AND send_hour <= 23),
    CONSTRAINT CK_NotificationPreferences_SendMinute CHECK (send_minute >= 0 AND send_minute <= 59)
  );
END
GO

-- One reminder ever per bill (not a log table with a type column) since v1 has exactly one
-- notification kind — a bill re-entering the lead-time window after this is set never re-fires.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Bills') AND name = 'reminder_sent_at')
  ALTER TABLE dbo.Bills ADD reminder_sent_at DATETIME2(3) NULL;
GO
