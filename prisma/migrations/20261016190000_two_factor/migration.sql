-- A4: the last TOTP time step accepted, so a code can't be used twice.
ALTER TABLE "users" ADD COLUMN "totp_last_step" INTEGER;
