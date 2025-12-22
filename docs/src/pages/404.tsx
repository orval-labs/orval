import LayoutDocs from '@/components/LayoutDocs';

export default function NotFound() {
  return (
    <LayoutDocs meta={{ id: '404', title: 'Page Not Found' }}>
      <h1>Snap! We couldn't find that page.</h1>
      <p>Please use the menu to find what you're looking for.</p>
      <img src="https://media.giphy.com/media/27EhcDHnlkw1O/giphy.gif" />
    </LayoutDocs>
  );
}
