CREATE TABLE "countries" (
	"code" varchar(3) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
