'use client'

import { useState, useEffect, useCallback } from 'react'

// Extended dialog interface for storing event handlers
interface DialogWithHandlers extends HTMLDialogElement {
  _inertObserver?: MutationObserver
}

// Dialog state interface
interface DialogState {
  dialogActive: boolean
  visible: boolean
  bodyStyle: CSSStyleDeclaration | null
  opener: HTMLElement | null
}

// IMPORTANT: WebAuthn does NOT work in cross-origin iframes!
// Porto solves this with session keys (temporary keys that don't need WebAuthn).
// Since WebSig doesn't have session keys yet, we must use popups for cross-origin.
// Once WebSig implements session keys, the iframe approach will work.

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [walletStatus, setWalletStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [iframeReady, setIframeReady] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  
  // Production configuration for LiquidRoute
  // When deployed to app.liquidroute.com, this will use production WebSig
  const WEBSIG_URL = process.env.NEXT_PUBLIC_WEBSIG_URL || 'https://websig.xyz'
  const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'LiquidRoute'
  const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'https://app.liquidroute.com')

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(`[LiquidRoute] ${message}`)
  }

  // Porto's exact implementation (seamless mode for Uniswap-like integration)
  const showIframe = useCallback((seamless: boolean = true) => {
    // Helper function for logging within this scope
    const log = (message: string) => {
      const timestamp = new Date().toLocaleTimeString()
      setLogs(prev => [...prev, `[${timestamp}] ${message}`])
      console.log(`[LiquidRoute] ${message}`)
    }
    // These need to be inside the function to maintain state across calls
    const dialogState = ((window as any).__dialogState || {
      dialogActive: false,
      visible: false,
      bodyStyle: null,
      opener: null
    }) as DialogState;
    (window as any).__dialogState = dialogState

    // Porto's exact dialog creation
    let dialog = document.getElementById('websig-dialog') as HTMLDialogElement
    let iframe = document.getElementById('websig-iframe') as HTMLIFrameElement
    
    if (!dialog) {
      // Create dialog EXACTLY like Porto
      dialog = document.createElement('dialog')
      dialog.dataset.porto = ''
      dialog.id = 'websig-dialog'
      
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('aria-closed', 'true')
      dialog.setAttribute('aria-label', 'Porto Wallet')
      dialog.setAttribute('hidden', 'until-found')
      
      // Porto's exact style - Modal dialog container
      Object.assign(dialog.style, {
        background: 'transparent', // Transparent so iframe shows through
        border: 'none',
        outline: 'none',
        padding: '0',
        margin: 'auto', // Center the dialog
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '420px', // Fixed width
        height: '600px', // Fixed height
        borderRadius: '12px',
        overflow: 'hidden',
        zIndex: '999999', // High but not max
        pointerEvents: 'auto', // Ensure dialog accepts pointer events
      })
      
      document.body.appendChild(dialog)
      
      // Create iframe EXACTLY like Porto if it doesn't exist
      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.id = 'websig-iframe'
        iframe.setAttribute('data-testid', 'porto')
        // Porto's exact approach - set permissions to the WebSig origin
        iframe.setAttribute('allow', `publickey-credentials-get ${WEBSIG_URL}; publickey-credentials-create ${WEBSIG_URL}; clipboard-write`)
        iframe.setAttribute('tabindex', '0')
        // Remove sandbox to allow full interaction
        // iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')
        
        // Build the iframe URL - no seamless mode for modal
        const iframeUrl = `${WEBSIG_URL}/connect?origin=${encodeURIComponent(APP_ORIGIN)}&name=${encodeURIComponent(APP_NAME)}`
        log(`Loading iframe: ${iframeUrl}`)
        iframe.setAttribute('src', iframeUrl)
        iframe.setAttribute('title', 'Porto')
        
        // Add load/error handlers for debugging
        iframe.onload = () => {
          log('Iframe loaded successfully')
          setIframeReady(true) // Mark iframe as ready
          // Focus the iframe after it loads
          setTimeout(() => {
            iframe.focus()
            iframe.contentWindow?.focus()
          }, 100)
        }
        iframe.onerror = (e) => log(`Iframe error: ${e}`)
        
        // Porto's exact iframe style - fills the dialog
        Object.assign(iframe.style, {
          backgroundColor: 'white',
          border: 'none',
          colorScheme: 'light dark',
          height: '100%', // Fill dialog height
          width: '100%',
          borderRadius: '12px', // Match dialog radius
          display: 'block',
          pointerEvents: 'auto', // Ensure iframe accepts all pointer events
          position: 'relative',
          zIndex: '1', // Ensure iframe is on top within dialog
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)', // Add shadow for visibility
        })
      }
      
      // Add Porto's exact CSS with backdrop
      const style = document.createElement('style')
      style.innerHTML = `
        dialog[data-porto]::backdrop {
          background: rgba(0, 0, 0, 0.5)!important; /* Semi-transparent backdrop */
          backdrop-filter: blur(4px);
          pointer-events: auto!important;
        }
        dialog[data-porto] {
          pointer-events: auto!important;
        }
        dialog[data-porto] iframe {
          pointer-events: auto!important;
        }
      `
      
      dialog.appendChild(style)
      dialog.appendChild(iframe)
      
      // Porto's 1password workaround - only create if MutationObserver exists
      let inertObserver: MutationObserver | null = null
      if (typeof MutationObserver !== 'undefined') {
        inertObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type !== 'attributes') continue
            const name = mutation.attributeName
            if (!name || name !== 'inert') continue
            dialog.removeAttribute(name)
          }
        })
        inertObserver.observe(dialog, {
          attributeOldValue: true,
          attributes: true,
        })
      }
      
      // Store hideIframe function globally for event handlers
      (window as any).__hideWebSigDialog = () => {
        // We'll trigger the hide from outside
        window.postMessage({ topic: 'websig:close_dialog' }, window.location.origin)
      }
      
      // Add escape key handler for the dialog
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const hideDialog = (window as any).__hideWebSigDialog
          if (typeof hideDialog === 'function') hideDialog()
        }
      })
      
      // Add click-outside handler for the backdrop
      dialog.addEventListener('click', (e) => {
        // Only close if clicking the backdrop (not the iframe)
        if (e.target === dialog) {
          const hideDialog = (window as any).__hideWebSigDialog
          if (typeof hideDialog === 'function') hideDialog()
        }
      })
      
      // Store the observer for cleanup (if it exists)
      if (inertObserver) {
        const dialogWithHandlers = dialog as DialogWithHandlers
        dialogWithHandlers._inertObserver = inertObserver
      }
    }
    
    // Porto's exact showDialog function
    if (dialogState.visible) return
    dialogState.visible = true
    
    // Store the opener element to restore focus later (Porto)
    if (document.activeElement instanceof HTMLElement)
      dialogState.opener = document.activeElement
    
    dialog.removeAttribute('hidden')
    dialog.removeAttribute('aria-closed')
    dialog.showModal()
    
    // Porto's activateDialog function
    if (!dialogState.dialogActive) {
      dialogState.dialogActive = true
      
      iframe?.focus()
      // Dialog handles clicks normally
      
      // Hide body overflow to prevent scrolling when modal is open
      dialogState.bodyStyle = Object.assign({}, document.body.style) as CSSStyleDeclaration
      document.body.style.overflow = 'hidden'
      // document.body.style.overflow = 'hidden' // Commented out - Porto doesn't hide scroll
    }
    
    log('Dialog shown (Porto-style)')
  }, [WEBSIG_URL, APP_ORIGIN, APP_NAME])

  const hideIframe = useCallback(() => {
    const dialog = document.getElementById('websig-dialog') as HTMLDialogElement
    if (!dialog) return
    
    const dialogState = ((window as any).__dialogState || {
      dialogActive: false,
      visible: false,
      bodyStyle: null,
      opener: null
    }) as DialogState
    
    // Porto's exact hideDialog function
    if (!dialogState.visible) return
    dialogState.visible = false
    
    dialog.setAttribute('hidden', 'true')
    dialog.setAttribute('aria-closed', 'true')
    dialog.close()
    
    // Porto's cleanup for 1password extension
    for (const sibling of dialog.parentNode ? Array.from(dialog.parentNode.children) : []) {
      if (sibling === dialog) continue
      if (!sibling.hasAttribute('inert')) continue
      sibling.removeAttribute('inert')
    }
    
    // Porto's activatePage function
    if (dialogState.dialogActive) {
      dialogState.dialogActive = false
      
      dialogState.opener?.focus()
      dialogState.opener = null
      
      Object.assign(document.body.style, dialogState.bodyStyle ?? '')
      // Firefox: explicitly restore/clear overflow directly
      document.body.style.overflow = dialogState.bodyStyle?.overflow ?? ''
    }
    
    addLog('Dialog hidden (Porto-style)')
  }, [])

  // Handle client-side mounting to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    addLog('Page loaded, initializing WebSig iframe integration')
    
    // Setup message handler for iframe communication (Porto-style)
    const handleMessage = (event: MessageEvent) => {
      // Handle internal close dialog message
      if (event.origin === window.location.origin && event.data.topic === 'websig:close_dialog') {
        hideIframe()
        return
      }
      
      // Only accept messages from WebSig
      if (event.origin !== WEBSIG_URL) {
        addLog(`Ignoring message from untrusted origin: ${event.origin}`)
        return
      }

      addLog(`Received message: ${JSON.stringify(event.data)}`)

      // Porto-style messages use topic/payload format
      const { topic, payload } = event.data

      if (topic === 'websig:connected') {
        setIframeReady(true)
        setWalletAddress(payload.publicKey)
        setWalletStatus('connected')
        addLog(`Wallet connected: ${payload.publicKey}`)
        hideIframe()
      } else if (topic === 'websig:rejected') {
        setWalletStatus('disconnected')
        addLog('User rejected connection')
        hideIframe()
      } else if (topic === 'websig:error') {
        addLog(`Error from WebSig: ${payload.error}`)
        addLog(`Error type: ${payload.type}`)
        setWalletStatus('disconnected')
        // Don't hide on error - let user retry
      } else if (topic === 'websig:fallback_to_popup') {
        addLog(`WebAuthn blocked in iframe - opening popup instead`)
        hideIframe() // Close iframe first
        
        // Open WebSig in a popup window
        const popupUrl = `${WEBSIG_URL}/connect?origin=${encodeURIComponent(window.location.origin)}&name=${encodeURIComponent(APP_NAME)}`
        const popup = window.open(
          popupUrl,
          'websig-popup',
          'width=420,height=600,resizable,scrollbars=yes,status=1'
        )
        
        if (popup) {
          addLog('Popup opened successfully')
        } else {
          addLog('Popup blocked - please allow popups for this site')
        }
      } else if (event.data.method === 'show-iframe') {
        showIframe() // Porto doesn't pass params
      } else if (event.data.method === 'hide-iframe') {
        hideIframe()
      }
    }

    // Add escape key handler to close iframe
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const dialog = document.getElementById('websig-dialog')
        if (dialog && (dialog as any).open) {
          addLog('Escape key pressed - closing iframe')
          hideIframe()
        }
      }
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [WEBSIG_URL, showIframe, hideIframe])

  const connectWallet = async () => {
    addLog('Connecting wallet...')
    setWalletStatus('connecting')

    // Since WebSig doesn't have session keys like Porto,
    // we must use popup for cross-origin WebAuthn to work
    addLog('Opening popup for WebAuthn (cross-origin iframe limitation)...')
    
    const popupUrl = `${WEBSIG_URL}/connect?origin=${encodeURIComponent(window.location.origin)}&name=${encodeURIComponent(APP_NAME)}`
    const popup = window.open(
      popupUrl,
      'websig-popup',
      'width=420,height=600,resizable,scrollbars=yes,status=1'
    )
    
    if (popup) {
      addLog('Popup opened successfully - WebAuthn will work here')
      // The popup will send a message back when connected
    } else {
      addLog('Popup blocked - please allow popups for this site')
      setWalletStatus('disconnected')
    }
  }

  const signTransaction = async () => {
    addLog('Signing transaction...')
    
    // Porto approach: First show the dialog
    showIframe()
    
    // Now get the iframe after it's shown
    const iframe = document.getElementById('websig-iframe') as HTMLIFrameElement
    if (!iframe || !iframe.contentWindow) {
      addLog('Error: iframe not found after creation')
      return
    }

    // Send transaction message exactly like Porto (with id)
    const messageId = crypto.randomUUID()
    iframe.contentWindow.postMessage(
      {
        id: messageId,
        topic: 'websig:signTransaction',
        payload: {
          transaction: 'mock_transaction_data'
        }
      },
      WEBSIG_URL
    )
  }

  // Prevent SSR hydration issues
  if (!mounted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-800 rounded w-3/4 mb-4"></div>
            <div className="h-6 bg-gray-800 rounded w-1/2"></div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">LiquidRoute Wallet Integration</h1>
        <p className="text-gray-400 mb-4">Production cross-origin HTTPS integration with WebSig wallet</p>
        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-6">
          <p className="text-yellow-400 text-sm">
            <strong>Note:</strong> WebAuthn doesn't work in cross-origin iframes. Using popup mode until WebSig implements session keys like Porto.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Wallet Status */}
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Wallet Status</h2>
            <p className="text-xs text-gray-500 mb-2">
              {APP_ORIGIN} → {WEBSIG_URL}
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`font-mono ${
                  walletStatus === 'connected' ? 'text-green-400' : 
                  walletStatus === 'connecting' ? 'text-yellow-400' : 
                  'text-red-400'
                }`}>
                  {walletStatus}
                </span>
              </div>
              
              {walletAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Address:</span>
                  <span className="font-mono text-sm text-blue-400">
                    {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                  </span>
                </div>
              )}
              
              {iframeReady && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">iframe:</span>
                  <span className="text-green-400">Ready</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            
            <div className="space-y-3">
              <button
                onClick={connectWallet}
                disabled={walletStatus === 'connecting'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {walletStatus === 'connecting' ? 'Connecting...' : 
                 walletStatus === 'connected' ? 'Reconnect' : 
                 'Connect Wallet'}
              </button>
              
              <button
                onClick={signTransaction}
                disabled={walletStatus !== 'connected'}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign Transaction
              </button>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="mt-8 bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-black/50 text-gray-300 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log, index) => (
                <p key={index} className="mb-1">{log}</p>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Porto creates the iframe dynamically in the dialog - no iframe here */}
    </main>
  )
}