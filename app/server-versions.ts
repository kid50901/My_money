import {getDb} from '../db';
import {ledgerVersions} from '../db/schema';
import {eq,desc} from 'drizzle-orm';
export async function versionsFor(id:string){return getDb().select({id:ledgerVersions.id,createdAt:ledgerVersions.createdAt,label:ledgerVersions.label}).from(ledgerVersions).where(eq(ledgerVersions.userId,id)).orderBy(desc(ledgerVersions.createdAt)).limit(20)}
