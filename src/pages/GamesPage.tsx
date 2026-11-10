export default function GamesPage() {
  return (
    <iframe
      src="/games/cookieclicker/index.html"
      style={{ width: '100%', height: '100vh', border: 'none' }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
