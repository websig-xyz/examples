# WebSig iframe Integration Example (LiquidRoute)

This example demonstrates production-ready integration of WebSig wallet using Porto-style seamless iframes. Configured for deployment as LiquidRoute (app.liquidroute.com) connecting to production WebSig (websig.xyz).

## 🌐 Production Deployment (HTTPS to HTTPS)

### Deploy to Vercel (Recommended for app.liquidroute.com)

1. **Deploy this example to Vercel:**
   ```bash
   cd examples
   vercel
   ```

2. **Set your custom domain in Vercel:**
   - Add `app.liquidroute.com` as a custom domain
   - Vercel will handle SSL certificates automatically

3. **Environment Variables:**
   The app automatically uses production WebSig when deployed:
   - `WEBSIG_URL`: https://websig.xyz (default)
   - `APP_NAME`: LiquidRoute (default)

### How It Works in Production

When deployed to `https://app.liquidroute.com`:
1. User clicks "Connect Wallet" on LiquidRoute
2. Porto-style transparent iframe loads WebSig from `https://websig.xyz`
3. User authenticates with their passkey
4. Secure cross-origin communication via postMessage
5. Wallet appears seamlessly integrated into LiquidRoute

## 🚀 Local Development

### 1. Start WebSig (Main App)

In the root directory:

```bash
cd /Users/maurodelazeri/work/src/github.com/quiknode-labs/websig
yarn dev
```

This will start WebSig on http://localhost:3000

### 2. Start the Example App

In another terminal:

```bash
cd /Users/maurodelazeri/work/src/github.com/quiknode-labs/websig/examples
yarn dev
```

This will start the example on http://localhost:4000

### 3. Test the Integration

1. Open http://localhost:4000 in your browser
2. Click "Connect Wallet" 
3. The WebSig connect dialog will appear in an iframe overlay
4. Sign in or create a new account
5. Once connected, you can test transaction signing

## 🏗️ How It Works

### iframe Setup

The example embeds WebSig's `/connect` endpoint in a hidden iframe:

```html
<iframe
  id="websig-iframe"
  src="http://localhost:3000/connect?origin=http://localhost:4000&name=Your%20App"
  allow="publickey-credentials-get *; publickey-credentials-create *"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  style="display: none"
/>
```

### Message Communication

Communication uses Porto-style `postMessage` with topic/payload format:

```javascript
// Request connection
iframe.contentWindow.postMessage({
  topic: 'websig:connect',
  payload: { origin: window.location.origin }
}, 'http://localhost:3000')

// Listen for response
window.addEventListener('message', (event) => {
  if (event.data.topic === 'websig:connected') {
    console.log('Wallet connected:', event.data.payload.publicKey)
  }
})
```

### Key Features

- **Seamless UX**: No popups or redirects
- **Cross-Origin Support**: Works across different domains
- **WebAuthn Compatible**: Full biometric authentication support
- **Porto-Style Design**: Clean, minimal UI that matches Porto's aesthetic

## 📋 Requirements

### Browser Support

- Chrome/Edge 123+ (Full WebAuthn in iframes)
- Firefox (Partial support)
- Safari (Falls back to popup mode)

### Permissions

The iframe requires these permissions:
- `publickey-credentials-get`: For WebAuthn authentication
- `publickey-credentials-create`: For creating new passkeys
- `allow-scripts`: For JavaScript execution
- `allow-same-origin`: For localStorage/cookies
- `allow-forms`: For form submission
- `allow-popups`: For fallback popup mode

## 🔒 Security Considerations

1. **Always verify message origins** in production
2. **Use HTTPS** for production deployments
3. **Implement CSP headers** appropriately
4. **Validate all messages** before processing

## 🎨 Customization

You can customize the iframe appearance by:

1. Adjusting the modal size in `showIframe()`
2. Styling the backdrop overlay
3. Adding loading states
4. Implementing error handling

## 📝 Notes

- The `/connect` endpoint automatically detects iframe context
- Falls back to popup mode if WebAuthn is restricted
- Maintains connection state via cookies and localStorage
- Supports multiple wallets and account switching

## 🏗️ Production Architecture (LiquidRoute)

### Cross-Origin HTTPS Setup
```
https://app.liquidroute.com (LiquidRoute dApp)
    ↓ iframe embed (Porto-style)
https://websig.xyz/connect (WebSig Wallet)
```

### Required Configuration

1. **LiquidRoute Side (app.liquidroute.com)**:
   - Deploy this example to your domain
   - No special headers needed (handled by vercel.json)
   - Permissions-Policy allows WebAuthn

2. **WebSig Side (websig.xyz)**:
   - `/connect` endpoint allows iframe embedding
   - Proper CORS and CSP headers configured
   - WebAuthn works in cross-origin iframes

### Porto Compliance Features
- ✅ Transparent dialog element with `showModal()`
- ✅ Full-screen transparent iframe
- ✅ Content controls visual appearance
- ✅ 1Password extension workarounds
- ✅ Proper focus management
- ✅ Escape key and click-outside handling
- ✅ Message format with UUID

## 🐛 Troubleshooting

### iframe Not Loading
- Check CSP headers allow framing
- Verify origins match in console
- Ensure WebSig is running on port 3000

### WebAuthn Not Working
- Use HTTPS in production
- Check browser console for permission errors
- Verify `allow` attributes on iframe

### Connection Not Persisting
- Check cookie settings
- Verify localStorage is enabled
- Check SameSite cookie attributes

## 📚 Resources

- [WebAuthn in iframes](https://github.com/w3c/webauthn/issues/1336)
- [Porto Wallet](https://github.com/portowallet/porto)
- [Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy)