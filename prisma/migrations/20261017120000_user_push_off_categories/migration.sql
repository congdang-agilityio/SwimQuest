-- Push categories a player switched off (S-68, #388). Empty = every category on.
ALTER TABLE "User" ADD COLUMN     "pushOffCategories" "NotificationCategory"[] DEFAULT ARRAY[]::"NotificationCategory"[];
