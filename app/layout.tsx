import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '游园灯', description: '挂上照片，让回忆随光旋转。' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="zh-CN"><body>{children}</body></html>; }
