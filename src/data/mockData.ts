export type DateRangeKey = 'today' | '7d' | '30d' | '1y' | 'custom'

export type Product = {
  id: number
  name: string
  sku: string
  category: string
  stock: number
  status: 'In Stock' | 'Low Stock' | 'Out of Stock'
  price: number
  cost: number
  image: string
  description: string
}

export type SalesHistoryRecord = {
  id: string
  customer: string
  date: string
  items: number
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer'
  amount: number
  status: 'Completed' | 'Pending' | 'Refunded'
}

export type CartItem = {
  id: number
  name: string
  price: number
  quantity: number
}

const svgImage = (label: string, color: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="34" fill="url(#g)" />
      <circle cx="122" cy="42" r="20" fill="rgba(255,255,255,0.16)" />
      <text x="50%" y="54%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="700" fill="white">${label}</text>
    </svg>
  `

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const dateRangeOptions: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '1y', label: '1 Year' },
  { key: 'custom', label: 'Custom Date Range' },
]

export const dashboardMetricsByRange: Record<DateRangeKey, Record<string, string | number>> = {
  today: {
    revenue: 128450,
    profit: 36520,
    inventoryValue: 912300,
    totalProducts: 248,
    lowStockProducts: 12,
    dailySales: 68,
  },
  '7d': {
    revenue: 642800,
    profit: 171900,
    inventoryValue: 912300,
    totalProducts: 248,
    lowStockProducts: 12,
    dailySales: 428,
  },
  '30d': {
    revenue: 2456300,
    profit: 712420,
    inventoryValue: 912300,
    totalProducts: 248,
    lowStockProducts: 12,
    dailySales: 1860,
  },
  '1y': {
    revenue: 26843000,
    profit: 7418200,
    inventoryValue: 912300,
    totalProducts: 248,
    lowStockProducts: 12,
    dailySales: 22540,
  },
  custom: {
    revenue: 3389200,
    profit: 983410,
    inventoryValue: 912300,
    totalProducts: 248,
    lowStockProducts: 12,
    dailySales: 2480,
  },
}

export const salesOverviewByRange = {
  today: [
    { label: '8 AM', sales: 8, profit: 2.8 },
    { label: '10 AM', sales: 14, profit: 4.2 },
    { label: '12 PM', sales: 22, profit: 7.4 },
    { label: '2 PM', sales: 18, profit: 5.9 },
    { label: '4 PM', sales: 26, profit: 8.3 },
    { label: '6 PM', sales: 20, profit: 6.5 },
  ],
  '7d': [
    { label: 'Mon', sales: 92, profit: 28 },
    { label: 'Tue', sales: 118, profit: 39 },
    { label: 'Wed', sales: 106, profit: 34 },
    { label: 'Thu', sales: 142, profit: 48 },
    { label: 'Fri', sales: 156, profit: 54 },
    { label: 'Sat', sales: 188, profit: 68 },
    { label: 'Sun', sales: 164, profit: 59 },
  ],
  '30d': [
    { label: 'W1', sales: 560, profit: 178 },
    { label: 'W2', sales: 680, profit: 214 },
    { label: 'W3', sales: 740, profit: 248 },
    { label: 'W4', sales: 870, profit: 290 },
  ],
  '1y': [
    { label: 'Jan', sales: 2200, profit: 760 },
    { label: 'Feb', sales: 2140, profit: 730 },
    { label: 'Mar', sales: 2580, profit: 862 },
    { label: 'Apr', sales: 2860, profit: 918 },
    { label: 'May', sales: 3050, profit: 1004 },
    { label: 'Jun', sales: 3220, profit: 1088 },
    { label: 'Jul', sales: 3360, profit: 1112 },
    { label: 'Aug', sales: 3510, profit: 1170 },
    { label: 'Sep', sales: 3440, profit: 1146 },
    { label: 'Oct', sales: 3680, profit: 1218 },
    { label: 'Nov', sales: 3890, profit: 1288 },
    { label: 'Dec', sales: 4210, profit: 1402 },
  ],
  custom: [
    { label: 'Q1', sales: 1240, profit: 418 },
    { label: 'Q2', sales: 1710, profit: 554 },
    { label: 'Q3', sales: 1880, profit: 602 },
    { label: 'Q4', sales: 2460, profit: 784 },
  ],
}

export const bestSellingProducts = [
  { name: 'Premium Cooking Oil', orders: 482, margin: 34 },
  { name: 'Orange Juice 1L', orders: 431, margin: 28 },
  { name: 'Rice 25kg Bag', orders: 395, margin: 21 },
  { name: 'Bath Soap Pack', orders: 358, margin: 24 },
  { name: 'Laundry Detergent', orders: 312, margin: 29 },
]

export const monthlyRevenue = [
  { month: 'Jan', revenue: 78000 },
  { month: 'Feb', revenue: 86000 },
  { month: 'Mar', revenue: 91000 },
  { month: 'Apr', revenue: 98000 },
  { month: 'May', revenue: 112000 },
  { month: 'Jun', revenue: 121000 },
  { month: 'Jul', revenue: 132000 },
  { month: 'Aug', revenue: 129000 },
  { month: 'Sep', revenue: 137000 },
  { month: 'Oct', revenue: 145000 },
  { month: 'Nov', revenue: 158000 },
  { month: 'Dec', revenue: 172000 },
]

export const analyticsRevenue = [
  { label: 'Week 1', revenue: 240000, profit: 62000, margin: 26 },
  { label: 'Week 2', revenue: 260000, profit: 69000, margin: 27 },
  { label: 'Week 3', revenue: 285000, profit: 82000, margin: 29 },
  { label: 'Week 4', revenue: 312000, profit: 91000, margin: 29 },
  { label: 'Week 5', revenue: 336000, profit: 102000, margin: 30 },
]

export const inventoryMovement = [
  { label: 'Received', value: 8800 },
  { label: 'Sold', value: 7350 },
  { label: 'Adjusted', value: 460 },
  { label: 'Returned', value: 270 },
]

export const products: Product[] = [
  {
    id: 1,
    name: 'Premium Cooking Oil',
    sku: 'FOOD-001',
    category: 'Groceries',
    stock: 48,
    status: 'In Stock',
    price: 420,
    cost: 310,
    image: svgImage('OIL', '#ea580c'),
    description: 'Refined sunflower oil for retail and bulk supply.',
  },
  {
    id: 2,
    name: 'Rice 25kg Bag',
    sku: 'FOOD-008',
    category: 'Groceries',
    stock: 12,
    status: 'Low Stock',
    price: 2900,
    cost: 2500,
    image: svgImage('RICE', '#16a34a'),
    description: 'Wholesale grain stock with high daily turnover.',
  },
  {
    id: 3,
    name: 'Bath Soap Pack',
    sku: 'FMCG-021',
    category: 'Household',
    stock: 0,
    status: 'Out of Stock',
    price: 175,
    cost: 110,
    image: svgImage('SOAP', '#0284c7'),
    description: 'Multipack soap for convenience stores and mini markets.',
  },
  {
    id: 4,
    name: 'Orange Juice 1L',
    sku: 'DRK-014',
    category: 'Beverages',
    stock: 64,
    status: 'In Stock',
    price: 190,
    cost: 128,
    image: svgImage('OJ', '#f97316'),
    description: 'Chilled juice with strong repeat purchase volume.',
  },
  {
    id: 5,
    name: 'Laundry Detergent',
    sku: 'HYG-006',
    category: 'Household',
    stock: 33,
    status: 'In Stock',
    price: 260,
    cost: 180,
    image: svgImage('WASH', '#7c3aed'),
    description: 'High-margin laundry powder sold across neighborhood retailers.',
  },
]

export const inventoryBatches = [
  { id: 1, product: 'Premium Cooking Oil', quantity: 120, unitCost: 305, remainingStock: 48, purchaseDate: '2026-05-06' },
  { id: 2, product: 'Premium Cooking Oil', quantity: 90, unitCost: 312, remainingStock: 35, purchaseDate: '2026-05-12' },
  { id: 3, product: 'Rice 25kg Bag', quantity: 30, unitCost: 2480, remainingStock: 12, purchaseDate: '2026-05-08' },
  { id: 4, product: 'Orange Juice 1L', quantity: 180, unitCost: 122, remainingStock: 64, purchaseDate: '2026-05-14' },
  { id: 5, product: 'Laundry Detergent', quantity: 60, unitCost: 176, remainingStock: 33, purchaseDate: '2026-05-10' },
]

export const recentSales = [
  { id: 'SA-1042', customer: 'Addis Retail', amount: 8460, items: 18, status: 'Completed' },
  { id: 'SA-1041', customer: 'Bole Mini Market', amount: 5520, items: 12, status: 'Completed' },
  { id: 'SA-1040', customer: 'Kality Traders', amount: 11480, items: 26, status: 'Pending' },
  { id: 'SA-1039', customer: 'Merkato Wholesale', amount: 9720, items: 21, status: 'Completed' },
]

export const salesHistory: SalesHistoryRecord[] = [
  { id: 'SA-1042', customer: 'Addis Retail', date: '2026-05-18', items: 18, paymentMethod: 'Cash', amount: 8460, status: 'Completed' },
  { id: 'SA-1041', customer: 'Bole Mini Market', date: '2026-05-17', items: 12, paymentMethod: 'Card', amount: 5520, status: 'Completed' },
  { id: 'SA-1040', customer: 'Kality Traders', date: '2026-05-16', items: 26, paymentMethod: 'Bank Transfer', amount: 11480, status: 'Pending' },
  { id: 'SA-1039', customer: 'Merkato Wholesale', date: '2026-05-15', items: 21, paymentMethod: 'Mobile Money', amount: 9720, status: 'Completed' },
  { id: 'SA-1038', customer: 'Arada Shop', date: '2026-05-14', items: 9, paymentMethod: 'Cash', amount: 3520, status: 'Refunded' },
  { id: 'SA-1037', customer: 'Selam Grocery', date: '2026-05-13', items: 14, paymentMethod: 'Card', amount: 6120, status: 'Completed' },
]

export const lowStockAlerts = [
  { name: 'Rice 25kg Bag', stock: 12, limit: 15 },
  { name: 'Bath Soap Pack', stock: 0, limit: 25 },
  { name: 'Cooking Oil 10L', stock: 8, limit: 10 },
]

export const analyticsTables = {
  bestSelling: [
    { name: 'Premium Cooking Oil', units: 482, revenue: 202440, margin: '34%' },
    { name: 'Orange Juice 1L', units: 431, revenue: 81890, margin: '28%' },
    { name: 'Rice 25kg Bag', units: 395, revenue: 1145500, margin: '21%' },
  ],
  mostProfitable: [
    { name: 'Laundry Detergent', revenue: 83200, profit: 24100, margin: '29%' },
    { name: 'Premium Cooking Oil', revenue: 202440, profit: 68830, margin: '34%' },
    { name: 'Orange Juice 1L', revenue: 81890, profit: 22900, margin: '28%' },
  ],
  slowMoving: [
    { name: 'Bath Soap Pack', days: 28, stock: 0, turnover: 'Low' },
    { name: 'Cooking Spice Mix', days: 19, stock: 7, turnover: 'Low' },
    { name: 'Notebook Bundle', days: 22, stock: 4, turnover: 'Low' },
  ],
}

export const salesCatalog = products.map((product) => ({
  id: product.id,
  name: product.name,
  price: product.price,
  stock: product.stock,
  image: product.image,
}))
