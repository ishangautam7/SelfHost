from http.server import HTTPServer, SimpleHTTPRequestHandler

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.wfile.write(b'<h1>Hello from SelfHost!</h1><p>It works! Your app is being served through the tunnel.</p>')

print("Test server running on http://0.0.0.0:3333")
HTTPServer(('0.0.0.0', 3333), Handler).serve_forever()
