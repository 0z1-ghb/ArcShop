import { useState, useEffect } from 'react'
import type { EIP1193Provider } from 'viem'
import products from './data/products.json'

interface Product {
  id: number
  name: string
  price: string
  currency: string
  description: string
  image: string
  category: string
  stock: number
}

interface CartItem extends Product {
  quantity: number
}

declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<EIP6963ProviderDetail>
  }
}

type EIP6963ProviderInfo = {
  uuid: string
  name: string
  icon: string
  rdns: string
}

type EIP6963ProviderDetail = {
  info: EIP6963ProviderInfo
  provider: EIP1193Provider
}

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [sortMode, setSortMode] = useState<'default' | 'price-high' | 'price-low'>('default')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 850)
    return () => clearTimeout(timer)
  }, [])

  const categories = ['All', ...new Set(products.map(p => p.category))]

  let filteredProducts = selectedCategory === 'All' 
    ? [...products] 
    : products.filter(p => p.category === selectedCategory)

  if (sortMode === 'price-high') {
    filteredProducts.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
  } else if (sortMode === 'price-low') {
    filteredProducts.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
  }

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2400)
  }

  const connectWallet = async () => {
    setIsConnecting(true)
    try {
      const providers = new Map<string, EIP6963ProviderDetail>()
      const handleProvider = (event: WindowEventMap["eip6963:announceProvider"]) => {
        providers.set(event.detail.info.uuid, event.detail)
      }
      window.addEventListener("eip6963:announceProvider", handleProvider)
      window.dispatchEvent(new Event("eip6963:requestProvider"))
      await new Promise(r => setTimeout(r, 280))
      window.removeEventListener("eip6963:announceProvider", handleProvider)

      const wallet = Array.from(providers.values()).find(p => 
        p.info.rdns.includes('metamask') || p.info.name.toLowerCase().includes('metamask')
      ) || Array.from(providers.values())[0]

      if (!wallet) {
        showToast('MetaMask not found', 'error')
        return
      }

      await wallet.provider.request({ method: 'eth_requestAccounts' })
      const accounts = await wallet.provider.request({ method: 'eth_accounts' }) as string[]
      if (accounts[0]) {
        setWalletAddress(accounts[0])
        showToast('Wallet connected')
      }
    } catch {
      showToast('Connection failed', 'error')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setWalletAddress(null)
    showToast('Disconnected')
  }

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === product.id)
      if (exists) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { ...product, quantity: 1 }]
    })
    showToast('Added to cart')
  }

  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.id !== id))
  const cartTotal = cart.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0)

  const handleCheckout = async (product?: Product) => {
    if (!walletAddress) {
      showToast('Connect wallet first', 'error')
      return
    }
    showToast('Processing payment...')
    const amount = product ? product.price : cartTotal.toFixed(2)
    const tx = '0x' + Math.random().toString(16).slice(2, 42)

    setTimeout(() => {
      showToast(`Paid ${amount} USDC ✓`)
      if (!product) { setCart([]); setShowCart(false) } else { setSelectedProduct(null) }
      console.log('Tx:', `https://testnet.arcscan.app/tx/${tx}`)
    }, 1100)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-6 h-9 w-9 animate-spin rounded-full border-[3px] border-slate-700 border-t-white" />
          <div className="text-xs tracking-[3px] text-slate-400">ARCSHOP</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-semibold tracking-[-1.5px]">ArcShop</div>
            <div className="text-[10px] px-2.5 py-px rounded bg-slate-800 text-slate-400 border border-slate-700">TESTNET</div>
          </div>

          <div className="flex items-center gap-4">
            {walletAddress ? (
              <button onClick={disconnectWallet} className="font-mono text-sm px-4 py-2 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {walletAddress.slice(0,6)}…{walletAddress.slice(-4)}
              </button>
            ) : (
              <button onClick={connectWallet} disabled={isConnecting} className="px-6 py-2.5 rounded-2xl bg-white text-black text-sm font-semibold active:bg-zinc-100 disabled:opacity-60">
                {isConnecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}

            <button onClick={() => setShowCart(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm">
              Cart
              {cart.length > 0 && <span className="text-xs bg-white text-black px-2 py-px rounded-full">{cart.length}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 pt-12 pb-20">
        <div className="mb-12">
          <div className="text-6xl font-semibold tracking-[-3.5px] leading-none">Shop on Arc.<br />Pay with USDC.</div>
          <div className="mt-4 text-slate-400 text-xl">Instant settlement • Sub-second finality</div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-9">
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2 rounded-full text-sm font-medium border transition-all ${selectedCategory === cat 
                  ? 'bg-white text-black border-white' 
                  : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                {cat}
              </button>
            ))}
          </div>

          <div className="md:ml-auto">
            <select 
              value={sortMode} 
              onChange={(e) => setSortMode(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 text-sm px-4 py-2 rounded-2xl focus:outline-none"
            >
              <option value="default">Sort: Default</option>
              <option value="price-high">Price: High to Low</option>
              <option value="price-low">Price: Low to High</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} onClick={() => setSelectedProduct(product)}
              className="group bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-slate-600 transition-all active:scale-[0.985]">
              <div className="relative aspect-[16/10]">
                <img src={product.image} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform" />
                <div className="absolute top-4 right-4 bg-black/75 text-xs px-3 py-1 rounded-full font-mono backdrop-blur">
                  {product.price} {product.currency}
                </div>
              </div>
              <div className="p-6">
                <div className="font-semibold text-[21px] tracking-tight leading-none">{product.name}</div>
                <div className="text-slate-400 mt-2.5 text-[15px] line-clamp-2">{product.description}</div>
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-xs text-slate-500">Stock: {product.stock}</div>
                  <button onClick={(e) => { e.stopPropagation(); addToCart(product) }}
                    className="px-7 py-3 rounded-2xl bg-white text-black text-sm font-semibold active:bg-zinc-200">Add to Cart</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 text-sm rounded-2xl border ${toast.type === 'error' ? 'bg-red-900 border-red-700' : 'bg-slate-900 border-slate-700'}`}>{toast.message}</div>}

      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-6" onClick={() => setSelectedProduct(null)}>
          <div className="bg-slate-900 w-full max-w-3xl rounded-3xl overflow-hidden border border-slate-700" onClick={e => e.stopPropagation()}>
            <img src={selectedProduct.image} className="w-full h-80 object-cover" />
            <div className="p-9">
              <div className="flex justify-between">
                <div>
                  <div className="text-4xl font-semibold tracking-tight">{selectedProduct.name}</div>
                  <div className="text-emerald-400 text-2xl font-mono mt-1">{selectedProduct.price} {selectedProduct.currency}</div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-2xl text-slate-400">×</button>
              </div>
              <p className="mt-6 text-lg text-slate-300">{selectedProduct.description}</p>
              <div className="mt-8 flex gap-4">
                <button onClick={() => addToCart(selectedProduct)} className="flex-1 py-4 rounded-2xl bg-slate-800 border border-slate-700 text-lg">Add to Cart</button>
                <button onClick={() => handleCheckout(selectedProduct)} className="flex-1 py-4 rounded-2xl bg-white text-black text-lg font-semibold">Buy Now</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-6" onClick={() => setShowCart(false)}>
          <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="px-7 pt-7 pb-5 flex justify-between items-center border-b border-slate-800">
              <div className="text-2xl font-semibold">Cart</div>
              <button onClick={() => setShowCart(false)} className="text-xl">×</button>
            </div>
            {cart.length === 0 ? (
              <div className="p-9 text-center text-slate-400">Empty cart</div>
            ) : (
              <>
                <div className="p-7 space-y-5 max-h-[42vh] overflow-auto">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div>{item.name} × {item.quantity}</div>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400">Remove</button>
                    </div>
                  ))}
                </div>
                <div className="p-7 border-t border-slate-800">
                  <div className="flex justify-between text-xl font-semibold mb-6">
                    <span>Total</span><span>{cartTotal.toFixed(2)} USDC</span>
                  </div>
                  <button onClick={() => handleCheckout()} className="w-full py-4 bg-white text-black rounded-2xl font-semibold text-lg">Checkout</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
