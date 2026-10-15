-- User.email must be stored lower-cased, so the case-sensitive unique index "User_email_key"
-- is also case-insensitive. Writes that bypass the client extension fail here.
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase_check" CHECK ("email" = lower("email"));
