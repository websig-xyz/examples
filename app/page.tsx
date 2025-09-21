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

export default function Home() {
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
      
      // Porto's exact style - FULLY transparent, no backdrop
      Object.assign(dialog.style, {
        background: 'transparent', // Fully transparent - no backdrop
        border: '0',
        outline: '0',
        padding: '0',
        position: 'fixed',
        inset: '0', // Full screen coverage
        maxWidth: '100vw',
        maxHeight: '100vh',
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Let clicks pass through to iframe
        zIndex: '2147483646', // Just below iframe
      })
      
      document.body.appendChild(dialog)
      
      // Create iframe EXACTLY like Porto if it doesn't exist
      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.id = 'websig-iframe'
        iframe.setAttribute('data-testid', 'porto')
        iframe.setAttribute('allow', `publickey-credentials-get ${WEBSIG_URL}; publickey-credentials-create ${WEBSIG_URL}; clipboard-write`)
        iframe.setAttribute('tabindex', '0')
        iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')
        
        // Build the iframe URL
        const iframeUrl = `${WEBSIG_URL}/connect?origin=${encodeURIComponent(APP_ORIGIN)}&name=${encodeURIComponent(APP_NAME)}&seamless=true`
        log(`Loading iframe: ${iframeUrl}`)
        iframe.setAttribute('src', iframeUrl)
        iframe.setAttribute('title', 'Porto')
        
        // Add load/error handlers for debugging
        iframe.onload = () => log('Iframe loaded successfully')
        iframe.onerror = (e) => log(`Iframe error: ${e}`)
        
        // Porto's exact iframe style - takes full control
        Object.assign(iframe.style, {
          backgroundColor: 'transparent',
          border: '0',
          colorScheme: 'light dark',
          height: '100%',
          left: '0',
          position: 'fixed',
          top: '0',
          width: '100%',
          zIndex: '2147483647', // Maximum z-index to ensure it's on top
          pointerEvents: 'auto', // Iframe handles all interactions
        })
      }
      
      // Add Porto's exact CSS
      const style = document.createElement('style')
      style.innerHTML = `
        dialog[data-porto]::backdrop {
          background: transparent!important;
        }
      `
      
      dialog.appendChild(style)
      dialog.appendChild(iframe)
      
      // Porto's 1password workaround
      const inertObserver = new MutationObserver((mutations) => {
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
      
      // Porto doesn't use escape or click-outside for seamless integration
      // The iframe content controls when to close
      
      // Store the observer for cleanup
      const dialogWithHandlers = dialog as DialogWithHandlers
      dialogWithHandlers._inertObserver = inertObserver
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
      // Keep dialog pointer-events as 'none' so iframe gets all clicks
      
      dialogState.bodyStyle = Object.assign({}, document.body.style) as CSSStyleDeclaration
      document.body.style.overflow = 'hidden'
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

  useEffect(() => {
    addLog('Page loaded, initializing WebSig iframe integration')
    
    // Setup message handler for iframe communication (Porto-style)
    const handleMessage = (event: MessageEvent) => {
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
      } else if (event.data.method === 'show-iframe') {
        showIframe() // Porto doesn't pass params
      } else if (event.data.method === 'hide-iframe') {
        hideIframe()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [WEBSIG_URL, showIframe, hideIframe])

  const connectWallet = async () => {
    addLog('Connecting wallet (seamless Uniswap-style)...')
    setWalletStatus('connecting')

    // Porto approach: Show seamless iframe (no modal borders)
    showIframe(true) // true = seamless mode like Uniswap

    // Now get the iframe after it's been created
    const iframe = document.getElementById('websig-iframe') as HTMLIFrameElement
    if (!iframe || !iframe.contentWindow) {
      addLog('Error: iframe not found after creation')
      return
    }

    // Send connect message exactly like Porto does (with id, topic, payload)
    const messageId = crypto.randomUUID()
    iframe.contentWindow.postMessage(
      {
        id: messageId,
        topic: 'websig:connect',
        payload: {
          origin: window.location.origin,
          name: APP_NAME,
          seamless: true // Tell WebSig to render in seamless mode
        }
      },
      WEBSIG_URL // Target origin
    )
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">LiquidRoute Wallet Integration</h1>
        <p className="text-gray-400 mb-8">Production cross-origin HTTPS integration with WebSig wallet</p>

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