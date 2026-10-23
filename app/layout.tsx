import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'月序 | 每月資產記帳',description:'把每個月，累積成理想生活。個人資產、收入與現金流管理。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-Hant"><body>{children}</body></html>}
