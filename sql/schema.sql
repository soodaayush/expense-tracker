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
