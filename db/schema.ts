import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const ledgers = sqliteTable('ledgers', { userId: text('user_id').primaryKey(), payload: text('payload').notNull(), updatedAt: text('updated_at').notNull() });

export const ledgerVersions = sqliteTable('ledger_versions', { id:text('id').primaryKey(), userId:text('user_id').notNull(), payload:text('payload').notNull(), createdAt:text('created_at').notNull(), label:text('label').notNull() },table=>[index('ledger_versions_user_created_idx').on(table.userId,table.createdAt)]);
