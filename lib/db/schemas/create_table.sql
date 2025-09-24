/*
primaryKey: PrimaryKey
name: Name
signature: Signature
*/

CREATE TABLE IF NOT EXISTS data (
  primaryKey VARCHAR(53) PRIMARY KEY,
  name VARCHAR(53) NOT NULL,
  primaryName VARCHAR(53) NOT NULL,
  fingerprint VARCHAR(106) NOT NULL,
  signature VARCHAR(128) NOT NULL
);

