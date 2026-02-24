import './globals.css'; // Optional: if you have global styles

export const metadata = {
  title: 'Cognito Research Engine',
  description: 'Multi-Agent Research Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}