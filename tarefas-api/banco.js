import "dotenv/config";
import { PrismaClient } from "./generated/prisma-js/index.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export default prisma;