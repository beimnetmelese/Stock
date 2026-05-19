import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  analyticsRevenue as fallbackAnalyticsRevenue,
  analyticsTables as fallbackAnalyticsTables,
  bestSellingProducts as fallbackBestSellingProducts,
  inventoryBatches as fallbackInventoryBatches,
  inventoryMovement as fallbackInventoryMovement,
  lowStockAlerts as fallbackLowStockAlerts,
  monthlyRevenue as fallbackMonthlyRevenue,
  products as fallbackProducts,
  recentSales as fallbackRecentSales,
  salesCatalog as fallbackSalesCatalog,
  salesHistory as fallbackSalesHistory,
  type DateRangeKey,
  type Product,
  type SalesHistoryRecord,
} from "../data/mockData";
import {
  deleteRows,
  hasSupabaseConfig,
  hasSupabaseSession,
  insertRows,
  rpcCall,
  selectRows,
  supabaseAuthChangeEvent,
  updateRows,
} from "./supabase";

export type InventoryBatchRecord = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  remaining_stock: number;
  purchase_date: string;
  supplier?: string | null;
};

export type SaleItemRecord = {
  id: number;
  sale_id: string;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  cost: number;
  total: number;
};

export type DashboardMetrics = {
  revenue: number;
  profit: number;
  inventoryValue: number;
  totalProducts: number;
  lowStockProducts: number;
  dailySales: number;
};

type BackendContextValue = {
  isLoading: boolean;
  error: string | null;
  products: Product[];
  inventoryBatches: InventoryBatchRecord[];
  salesHistory: SalesHistoryRecord[];
  saleItems: SaleItemRecord[];
  recentSales: typeof fallbackRecentSales;
  lowStockAlerts: typeof fallbackLowStockAlerts;
  dashboardMetricsByRange: Record<DateRangeKey, DashboardMetrics>;
  salesOverviewByRange: Record<
    DateRangeKey,
    Array<{ label: string; sales: number; profit: number }>
  >;
  bestSellingProducts: typeof fallbackBestSellingProducts;
  monthlyRevenue: typeof fallbackMonthlyRevenue;
  analyticsRevenue: typeof fallbackAnalyticsRevenue;
  inventoryMovement: typeof fallbackInventoryMovement;
  analyticsTables: typeof fallbackAnalyticsTables;
  salesCatalog: typeof fallbackSalesCatalog;
  saveProduct: (
    product: Partial<Product> & { image?: string },
  ) => Promise<void>;
  deleteProduct: (productId: number) => Promise<void>;
  addInventoryBatch: (batch: {
    productId: number;
    productName: string;
    quantity: number;
    unitCost: number;
    supplier: string;
    purchaseDate: string;
  }) => Promise<void>;
  registerSale: (payload: {
    customer: string;
    paymentMethod: "Cash" | "Card" | "Mobile Money" | "Bank Transfer";
    items: Array<{
      productId: number;
      productName: string;
      quantity: number;
      price: number;
      cost: number;
    }>;
  }) => Promise<void>;
  refresh: () => Promise<void>;
};

const BackendContext = createContext<BackendContextValue | null>(null);
const lowStockThreshold = 15;
const allowedPaymentMethods = new Set([
  "Cash",
  "Card",
  "Mobile Money",
  "Bank Transfer",
] as const);
const allowedSaleStatuses = new Set([
  "Completed",
  "Pending",
  "Refunded",
] as const);

function getCurrentDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatLabel(date: Date, range: DateRangeKey) {
  if (range === "1y") {
    return date.toLocaleDateString("en-US", { month: "short" });
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function inRange(
  dateValue: string,
  range: DateRangeKey,
  start?: string,
  end?: string,
) {
  const date = toDate(dateValue);
  const today = toDate(getCurrentDateKey());
  const day = 24 * 60 * 60 * 1000;

  if (range === "today") {
    return date.toDateString() === today.toDateString();
  }

  if (range === "7d") {
    return (
      date.getTime() >= today.getTime() - 6 * day &&
      date.getTime() <= today.getTime()
    );
  }

  if (range === "30d") {
    return (
      date.getTime() >= today.getTime() - 29 * day &&
      date.getTime() <= today.getTime()
    );
  }

  if (range === "1y") {
    return (
      date.getTime() >= today.getTime() - 365 * day &&
      date.getTime() <= today.getTime()
    );
  }

  if (range === "custom" && start && end) {
    const startDate = toDate(start);
    const endDate = toDate(end);
    return (
      date.getTime() >= startDate.getTime() &&
      date.getTime() <= endDate.getTime()
    );
  }

  return true;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + toFiniteNumber(value), 0);
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toDateKey(value: unknown) {
  const textValue = toText(value);
  if (!textValue) {
    return getCurrentDateKey();
  }

  return textValue.slice(0, 10);
}

function normalizePaymentMethod(
  value: unknown,
): SalesHistoryRecord["paymentMethod"] {
  const candidate = toText(value, "Cash");
  return allowedPaymentMethods.has(
    candidate as SalesHistoryRecord["paymentMethod"],
  )
    ? (candidate as SalesHistoryRecord["paymentMethod"])
    : "Cash";
}

function normalizeSaleStatus(value: unknown): SalesHistoryRecord["status"] {
  const candidate = toText(value, "Completed");
  return allowedSaleStatuses.has(candidate as SalesHistoryRecord["status"])
    ? (candidate as SalesHistoryRecord["status"])
    : "Completed";
}

function normalizeSalesHistoryRow(
  row: any,
  itemsBySaleId: Map<string, number>,
): SalesHistoryRecord {
  const saleId = String(row.id ?? row.sale_no ?? row.sale_id ?? "");
  const rowItems = Array.isArray(row.sale_items)
    ? row.sale_items.reduce(
        (total: number, item: any) => total + toFiniteNumber(item?.quantity),
        0,
      )
    : 0;

  return {
    id: saleId,
    customer: toText(row.customer, ""),
    date: toDateKey(row.sale_date ?? row.created_at ?? row.date),
    items:
      rowItems ||
      itemsBySaleId.get(saleId) ||
      toFiniteNumber(row.items_count ?? row.items),
    paymentMethod: normalizePaymentMethod(
      row.payment_method ?? row.paymentMethod,
    ),
    amount: toFiniteNumber(row.total_amount ?? row.amount ?? row.total),
    status: normalizeSaleStatus(row.status),
  };
}

function normalizeSaleItemRow(
  row: any,
  productNameById: Map<number, string>,
): SaleItemRecord {
  const productId = toFiniteNumber(row.product_id ?? row.productId);
  const quantity = toFiniteNumber(row.quantity);
  const price = toFiniteNumber(row.unit_price ?? row.price);
  const cost = toFiniteNumber(row.cost_unit ?? row.cost ?? 0);
  const total = toFiniteNumber(row.line_total ?? row.total ?? price * quantity);
  const productName =
    toText(row.product_name) ||
    toText(row.products?.name) ||
    toText(row.product?.name) ||
    productNameById.get(productId) ||
    `Product #${productId || row.id}`;

  return {
    id: toFiniteNumber(row.id),
    sale_id: String(row.sale_id ?? row.saleId ?? ""),
    product_id: productId,
    product_name: productName,
    quantity,
    price,
    cost,
    total,
  };
}

function calculateStatus(stock: number): Product["status"] {
  if (stock <= 0) return "Out of Stock";
  if (stock <= lowStockThreshold) return "Low Stock";
  return "In Stock";
}

function deriveRecentSales(salesHistory: SalesHistoryRecord[]) {
  return [...salesHistory]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 4);
}

function deriveLowStockAlerts(products: Product[]) {
  return products
    .filter((product) => product.stock <= lowStockThreshold)
    .slice(0, 3)
    .map((product) => ({
      name: product.name,
      stock: product.stock,
      limit: lowStockThreshold,
    }));
}

function buildProductCostLookup(
  products: Product[],
  inventoryBatches: InventoryBatchRecord[],
) {
  const lookup = new Map<number, number>();

  products.forEach((product) => {
    const cost = toFiniteNumber(product.cost);
    if (cost > 0) {
      lookup.set(product.id, cost);
    }
  });

  inventoryBatches.forEach((batch) => {
    const existingCost = lookup.get(batch.product_id) ?? 0;
    if (existingCost <= 0 && batch.unit_cost > 0) {
      lookup.set(batch.product_id, batch.unit_cost);
    }
  });

  return lookup;
}

function resolveItemCost(
  item: SaleItemRecord,
  productCostById: Map<number, number>,
) {
  return toFiniteNumber(item.cost) || productCostById.get(item.product_id) || 0;
}

function mapFallbackInventoryBatch(
  batch: (typeof fallbackInventoryBatches)[number],
): InventoryBatchRecord {
  const product = fallbackProducts.find((item) => item.name === batch.product);

  return {
    id: batch.id,
    product_id: product?.id ?? batch.id,
    product_name: batch.product,
    quantity: batch.quantity,
    unit_cost: batch.unitCost,
    remaining_stock: batch.remainingStock,
    purchase_date: batch.purchaseDate,
    supplier: null,
  };
}

function deriveDashboardMetrics(
  products: Product[],
  inventoryBatches: InventoryBatchRecord[],
  salesHistory: SalesHistoryRecord[],
  saleItems: SaleItemRecord[],
  range: DateRangeKey,
  customStart?: string,
  customEnd?: string,
): DashboardMetrics {
  const filteredSales = salesHistory.filter((sale) =>
    inRange(sale.date, range, customStart, customEnd),
  );
  const filteredItems = saleItems.filter((item) => {
    const sale = filteredSales.find(
      (entry) => String(entry.id) === String(item.sale_id),
    );
    return Boolean(sale);
  });
  const revenue = sum(filteredSales.map((sale) => sale.amount));
  const productCostById = buildProductCostLookup(products, inventoryBatches);
  const profit = sum(
    filteredItems.map((item) => {
      const salePrice = toFiniteNumber(item.price);
      const purchaseCost = resolveItemCost(item, productCostById);
      return (salePrice - purchaseCost) * toFiniteNumber(item.quantity);
    }),
  );

  const inventoryValue = sum(
    products.map(
      (product) =>
        toFiniteNumber(product.stock) *
        (productCostById.get(product.id) ?? toFiniteNumber(product.cost)),
    ),
  );

  return {
    revenue,
    profit,
    inventoryValue,
    totalProducts: products.length,
    lowStockProducts: products.filter(
      (product) => product.stock <= lowStockThreshold,
    ).length,
    dailySales: filteredSales.length,
  };
}

function deriveSalesOverview(
  products: Product[],
  inventoryBatches: InventoryBatchRecord[],
  salesHistory: SalesHistoryRecord[],
  saleItems: SaleItemRecord[],
  range: DateRangeKey,
  customStart?: string,
  customEnd?: string,
) {
  const filteredSales = salesHistory.filter((sale) =>
    inRange(sale.date, range, customStart, customEnd),
  );
  const productCostById = buildProductCostLookup(products, inventoryBatches);
  const buckets = new Map<
    string,
    { label: string; sales: number; profit: number }
  >();

  filteredSales.forEach((sale) => {
    const date = toDate(sale.date);
    const label = formatLabel(date, range);
    const current = buckets.get(label) ?? { label, sales: 0, profit: 0 };
    current.sales += sale.amount;
    const saleProfit = sum(
      saleItems
        .filter((item) => String(item.sale_id) === String(sale.id))
        .map((item) => {
          const salePrice = toFiniteNumber(item.price);
          const purchaseCost = resolveItemCost(item, productCostById);
          return (salePrice - purchaseCost) * toFiniteNumber(item.quantity);
        }),
    );
    current.profit += saleProfit;
    buckets.set(label, current);
  });

  return [...buckets.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function deriveMonthlyRevenue(salesHistory: SalesHistoryRecord[]) {
  const months = new Map<string, number>();

  salesHistory.forEach((sale) => {
    const key = toDate(sale.date).toLocaleDateString("en-US", {
      month: "short",
    });
    months.set(key, (months.get(key) ?? 0) + sale.amount);
  });

  return [...months.entries()].map(([month, revenue]) => ({ month, revenue }));
}

function deriveAnalyticsRevenue(
  salesHistory: SalesHistoryRecord[],
  saleItems: SaleItemRecord[],
) {
  const sorted = [...salesHistory].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const chunks: Array<Array<SalesHistoryRecord>> = [];
  const chunkSize = Math.max(1, Math.ceil(sorted.length / 5));

  for (let index = 0; index < sorted.length; index += chunkSize) {
    chunks.push(sorted.slice(index, index + chunkSize));
  }

  return chunks.map((chunk, index) => {
    const revenue = sum(chunk.map((sale) => sale.amount));
    const profit = sum(
      saleItems
        .filter((item) =>
          chunk.some((sale) => String(sale.id) === String(item.sale_id)),
        )
        .map(
          (item) =>
            (toFiniteNumber(item.price) - toFiniteNumber(item.cost)) *
            toFiniteNumber(item.quantity),
        ),
    );
    return {
      label: `Group ${index + 1}`,
      revenue,
      profit,
      margin: revenue ? Math.round((profit / revenue) * 100) : 0,
    };
  });
}

function deriveInventoryMovement(
  inventoryBatches: InventoryBatchRecord[],
  saleItems: SaleItemRecord[],
) {
  const received = sum(inventoryBatches.map((batch) => batch.quantity));
  const sold = sum(saleItems.map((item) => item.quantity));
  const adjusted = inventoryBatches.filter(
    (batch) => batch.remaining_stock !== batch.quantity,
  ).length;
  const returned = 0;

  return [
    { label: "Received", value: received },
    { label: "Sold", value: sold },
    { label: "Adjusted", value: adjusted },
    { label: "Returned", value: returned },
  ];
}

function deriveBestSellingProducts(
  products: Product[],
  saleItems: SaleItemRecord[],
) {
  const salesByProduct = new Map<
    number,
    { name: string; orders: number; margin: number }
  >();

  saleItems.forEach((item) => {
    const price = toFiniteNumber(item.price);
    const cost =
      toFiniteNumber(item.cost) || findProductCost(products, item.product_id);
    const current = salesByProduct.get(item.product_id) ?? {
      name: item.product_name,
      orders: 0,
      margin: 0,
    };
    current.orders += item.quantity;
    current.margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
    salesByProduct.set(item.product_id, current);
  });

  return [...salesByProduct.values()]
    .sort((left, right) => right.orders - left.orders)
    .slice(0, 5);
}

function deriveAnalyticsTables(
  products: Product[],
  saleItems: SaleItemRecord[],
) {
  const soldByProduct = new Map<
    number,
    {
      name: string;
      units: number;
      revenue: number;
      profit: number;
      days: number;
      stock: number;
    }
  >();

  saleItems.forEach((item) => {
    const price = toFiniteNumber(item.price);
    const quantity = toFiniteNumber(item.quantity);
    const total = toFiniteNumber(item.total, price * quantity);
    const cost =
      toFiniteNumber(item.cost) || findProductCost(products, item.product_id);
    const current = soldByProduct.get(item.product_id) ?? {
      name: item.product_name,
      units: 0,
      revenue: 0,
      profit: 0,
      days: 0,
      stock: findProductStock(products, item.product_id),
    };

    current.units += quantity;
    current.revenue += total;
    current.profit += Math.round((price - cost) * quantity);
    soldByProduct.set(item.product_id, current);
  });

  const byRevenue = [...soldByProduct.values()].sort(
    (left, right) => right.revenue - left.revenue,
  );
  const byProfit = [...soldByProduct.values()].sort(
    (left, right) => right.profit - left.profit,
  );

  return {
    bestSelling: byRevenue.slice(0, 3).map((row) => ({
      name: row.name,
      units: row.units,
      revenue: row.revenue,
      margin: `${row.revenue > 0 ? Math.round((row.profit / row.revenue) * 100) : 0}%`,
    })),
    mostProfitable: byProfit.slice(0, 3).map((row) => ({
      name: row.name,
      revenue: row.revenue,
      profit: row.profit,
      margin: `${row.revenue > 0 ? Math.round((row.profit / row.revenue) * 100) : 0}%`,
    })),
    slowMoving: products
      .slice()
      .sort((left, right) => left.stock - right.stock)
      .slice(0, 3)
      .map((product) => ({
        name: product.name,
        days: 21,
        stock: product.stock,
        turnover: product.stock <= lowStockThreshold ? "Low" : "Normal",
      })),
  };
}

function findProductCost(products: Product[], productId: number) {
  return toFiniteNumber(
    products.find((product) => product.id === productId)?.cost,
  );
}

function findProductStock(products: Product[], productId: number) {
  return toFiniteNumber(
    products.find((product) => product.id === productId)?.stock,
  );
}

async function loadSupabaseState() {
  if (!hasSupabaseConfig() || !hasSupabaseSession()) {
    return {
      products: fallbackProducts,
      inventoryBatches: fallbackInventoryBatches.map(mapFallbackInventoryBatch),
      salesHistory: fallbackSalesHistory,
      saleItems: [] as SaleItemRecord[],
    };
  }

  const selectRowsWithFallback = async <T,>(
    table: string,
    preferredQuery: string,
    fallbackQuery = "*",
  ) => {
    try {
      return await selectRows<T>(table, preferredQuery);
    } catch {
      if (fallbackQuery === preferredQuery) {
        throw new Error(`Failed to load ${table}`);
      }

      return selectRows<T>(table, fallbackQuery);
    }
  };

  const [products, inventoryBatches, salesHistoryRows, saleItemRows] =
    await Promise.all([
      selectRowsWithFallback<any>("products", "*"),
      selectRowsWithFallback<any>("inventory_batches", "*"),
      selectRowsWithFallback<any>(
        "sales",
        "id, sale_no, customer, sale_date, created_at, payment_method, total_amount, status, sale_items(quantity)",
      ),
      selectRowsWithFallback<any>(
        "sale_items",
        "id, sale_id, product_id, quantity, unit_price, cost_unit, line_total, product_name, products(name)",
      ),
    ]);

  const baseProducts = products.map((product: any) => ({
    id: toFiniteNumber(product.id),
    name: toText(product.name, "Unnamed Product"),
    sku: toText(product.sku, ""),
    category: toText(product.category, "General"),
    description: toText(product.description, ""),
    image: product.image_url ?? product.image ?? "",
    stock: toFiniteNumber(product.stock),
    price: toFiniteNumber(product.price),
    cost: toFiniteNumber(product.cost),
    status: calculateStatus(toFiniteNumber(product.stock)),
  }));

  const batchCostByProductId = new Map<number, number>();
  inventoryBatches.forEach((batch: any) => {
    const productId = toFiniteNumber(batch.product_id);
    const unitCost = toFiniteNumber(batch.unit_cost);
    if (productId && unitCost > 0 && !batchCostByProductId.has(productId)) {
      batchCostByProductId.set(productId, unitCost);
    }
  });

  const normalizedProducts = baseProducts.map((product) => ({
    ...product,
    cost:
      product.cost > 0
        ? product.cost
        : (batchCostByProductId.get(product.id) ?? 0),
  }));

  const productNameById = new Map(
    normalizedProducts.map((product) => [product.id, product.name]),
  );

  const normalizedSaleItems = saleItemRows.map((row: any) =>
    normalizeSaleItemRow(row, productNameById),
  );

  const itemsBySaleId = normalizedSaleItems.reduce((map, item) => {
    map.set(item.sale_id, (map.get(item.sale_id) ?? 0) + item.quantity);
    return map;
  }, new Map<string, number>());

  return {
    products: normalizedProducts,
    inventoryBatches: inventoryBatches.map((batch: any) => ({
      id: toFiniteNumber(batch.id),
      product_id: toFiniteNumber(batch.product_id),
      product_name: productNameById.get(toFiniteNumber(batch.product_id)) ?? "",
      quantity: toFiniteNumber(batch.quantity),
      unit_cost: toFiniteNumber(batch.unit_cost),
      remaining_stock: toFiniteNumber(batch.remaining_stock),
      purchase_date: toDateKey(batch.purchase_date),
      supplier: toText(batch.supplier, ""),
    })),
    salesHistory: salesHistoryRows.map((sale: any) =>
      normalizeSalesHistoryRow(sale, itemsBySaleId),
    ),
    saleItems: normalizedSaleItems,
  };
}

export function BackendProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [inventoryBatches, setInventoryBatches] = useState<
    InventoryBatchRecord[]
  >(() => fallbackInventoryBatches.map(mapFallbackInventoryBatch));
  const [salesHistory, setSalesHistory] =
    useState<SalesHistoryRecord[]>(fallbackSalesHistory);
  const [saleItems, setSaleItems] = useState<SaleItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customRange] = useState<{
    start?: string;
    end?: string;
  }>({});

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = await loadSupabaseState();
      setProducts(
        state.products.map((product) => ({
          ...product,
          status: calculateStatus(product.stock),
        })),
      );
      setInventoryBatches(state.inventoryBatches);
      setSalesHistory(state.salesHistory);
      setSaleItems(state.saleItems);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load backend data",
      );
      setProducts(fallbackProducts);
      setInventoryBatches(
        fallbackInventoryBatches.map(mapFallbackInventoryBatch),
      );
      setSalesHistory(fallbackSalesHistory);
      setSaleItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      void refresh();
    };

    window.addEventListener(supabaseAuthChangeEvent, handleAuthChange);
    void refresh();

    return () =>
      window.removeEventListener(supabaseAuthChangeEvent, handleAuthChange);
  }, [refresh]);

  const saveProduct = async (
    product: Partial<Product> & { image?: string },
  ) => {
    const existingProduct = product.id
      ? products.find((item) => item.id === product.id)
      : undefined;
    const nextProduct = {
      ...product,
      id: product.id ?? Date.now(),
      name: product.name ?? existingProduct?.name ?? "",
      sku: product.sku ?? existingProduct?.sku ?? "",
      category: product.category ?? existingProduct?.category ?? "Groceries",
      stock: product.stock ?? existingProduct?.stock ?? 0,
      status: calculateStatus(product.stock ?? existingProduct?.stock ?? 0),
      price: product.price ?? existingProduct?.price ?? 0,
      cost: product.cost ?? existingProduct?.cost ?? 0,
      image: product.image ?? existingProduct?.image ?? "",
      description: product.description ?? existingProduct?.description ?? "",
    } satisfies Product;

    setProducts((current) => {
      const exists = current.some((item) => item.id === nextProduct.id);
      const next = exists
        ? current.map((item) =>
            item.id === nextProduct.id ? nextProduct : item,
          )
        : [nextProduct, ...current];
      return next.map((item) => ({
        ...item,
        status: calculateStatus(item.stock),
      }));
    });

    if (hasSupabaseConfig()) {
      const productRow = {
        id: nextProduct.id,
        name: nextProduct.name,
        sku: nextProduct.sku,
        category: nextProduct.category,
        description: nextProduct.description,
        image_url: nextProduct.image,
        stock: nextProduct.stock,
        price: nextProduct.price,
        cost: nextProduct.cost,
        status: nextProduct.status,
      };

      if (product.id) {
        await updateRows("products", productRow, { id: product.id });
      } else {
        await insertRows("products", productRow);
      }
    }
  };

  const deleteProduct = async (productId: number) => {
    setProducts((current) =>
      current.filter((product) => product.id !== productId),
    );
    if (hasSupabaseConfig()) {
      await deleteRows("products", { id: productId });
    }
  };

  const addInventoryBatch = async (batch: {
    productId: number;
    productName: string;
    quantity: number;
    unitCost: number;
    supplier: string;
    purchaseDate: string;
  }) => {
    const nextBatch = {
      id: Date.now(),
      product_id: batch.productId,
      product_name: batch.productName,
      quantity: batch.quantity,
      unit_cost: batch.unitCost,
      remaining_stock: batch.quantity,
      purchase_date: batch.purchaseDate,
      supplier: batch.supplier,
    };

    setInventoryBatches((current) => [nextBatch, ...current]);
    setProducts((current) =>
      current.map((product) =>
        product.id === batch.productId
          ? {
              ...product,
              stock: product.stock + batch.quantity,
              status: calculateStatus(product.stock + batch.quantity),
            }
          : product,
      ),
    );

    if (hasSupabaseConfig()) {
      await insertRows("inventory_batches", {
        id: nextBatch.id,
        product_id: nextBatch.product_id,
        supplier: nextBatch.supplier,
        quantity: nextBatch.quantity,
        remaining_stock: nextBatch.remaining_stock,
        unit_cost: nextBatch.unit_cost,
        purchase_date: nextBatch.purchase_date,
      });
      await updateRows(
        "products",
        {
          stock: findProductStock(products, batch.productId) + batch.quantity,
          status: calculateStatus(
            findProductStock(products, batch.productId) + batch.quantity,
          ),
        },
        { id: batch.productId },
      );
    }
  };

  const registerSale = async (payload: {
    customer: string;
    paymentMethod: "Cash" | "Card" | "Mobile Money" | "Bank Transfer";
    items: Array<{
      productId: number;
      productName: string;
      quantity: number;
      price: number;
      cost: number;
    }>;
  }) => {
    const saleItemsPayload = payload.items.map((item) => ({
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price,
      cost: item.cost,
    }));

    if (hasSupabaseConfig()) {
      await rpcCall("record_sale", {
        sale_payload: {
          customer: payload.customer,
          payment_method: payload.paymentMethod,
          items: saleItemsPayload,
        },
      });
      await refresh();
      return;
    }

    const saleId = `SA-${Date.now()}`;
    const amount = sum(payload.items.map((item) => item.price * item.quantity));
    const nextSale: SalesHistoryRecord = {
      id: saleId,
      customer: payload.customer,
      date: getCurrentDateKey(),
      items: payload.items.reduce((total, item) => total + item.quantity, 0),
      paymentMethod: payload.paymentMethod,
      amount,
      status: "Completed",
    };

    setSalesHistory((current) => [nextSale, ...current]);
    setProducts((current) =>
      current.map((product) => {
        const match = payload.items.find(
          (item) => item.productId === product.id,
        );
        if (!match) return product;
        const nextStock = Math.max(0, product.stock - match.quantity);
        return {
          ...product,
          stock: nextStock,
          status: calculateStatus(nextStock),
        };
      }),
    );

    const nextSaleItems = payload.items.map((item, index) => ({
      id: Date.now() + index,
      sale_id: saleId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price,
      cost: item.cost,
      total: item.price * item.quantity,
    }));

    setSaleItems((current) => [...nextSaleItems, ...current]);
  };

  const dashboardMetricsByRange = useMemo(() => {
    return {
      today: deriveDashboardMetrics(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "today",
      ),
      "7d": deriveDashboardMetrics(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "7d",
      ),
      "30d": deriveDashboardMetrics(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "30d",
      ),
      "1y": deriveDashboardMetrics(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "1y",
      ),
      custom: deriveDashboardMetrics(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "custom",
        customRange.start,
        customRange.end,
      ),
    } satisfies Record<DateRangeKey, DashboardMetrics>;
  }, [
    products,
    inventoryBatches,
    salesHistory,
    saleItems,
    customRange.start,
    customRange.end,
  ]);

  const salesOverviewByRange = useMemo(() => {
    return {
      today: deriveSalesOverview(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "today",
      ),
      "7d": deriveSalesOverview(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "7d",
      ),
      "30d": deriveSalesOverview(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "30d",
      ),
      "1y": deriveSalesOverview(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "1y",
      ),
      custom: deriveSalesOverview(
        products,
        inventoryBatches,
        salesHistory,
        saleItems,
        "custom",
        customRange.start,
        customRange.end,
      ),
    } satisfies Record<
      DateRangeKey,
      Array<{ label: string; sales: number; profit: number }>
    >;
  }, [
    products,
    inventoryBatches,
    salesHistory,
    saleItems,
    customRange.start,
    customRange.end,
  ]);

  const monthlyRevenue = useMemo(
    () => deriveMonthlyRevenue(salesHistory),
    [salesHistory],
  );
  const analyticsRevenue = useMemo(
    () => deriveAnalyticsRevenue(salesHistory, saleItems),
    [salesHistory, saleItems],
  );
  const inventoryMovement = useMemo(
    () => deriveInventoryMovement(inventoryBatches, saleItems),
    [inventoryBatches, saleItems],
  );
  const bestSellingProducts = useMemo(
    () => deriveBestSellingProducts(products, saleItems),
    [products, saleItems],
  );
  const analyticsTables = useMemo(
    () => deriveAnalyticsTables(products, saleItems),
    [products, saleItems],
  );
  const lowStockAlerts = useMemo(
    () => deriveLowStockAlerts(products),
    [products],
  );
  const recentSales = useMemo(
    () => deriveRecentSales(salesHistory),
    [salesHistory],
  );
  const salesCatalog = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        image: product.image,
      })),
    [products],
  );

  const value = {
    isLoading,
    error,
    products,
    inventoryBatches,
    salesHistory,
    saleItems,
    recentSales,
    lowStockAlerts,
    dashboardMetricsByRange,
    salesOverviewByRange,
    bestSellingProducts,
    monthlyRevenue,
    analyticsRevenue,
    inventoryMovement,
    analyticsTables,
    salesCatalog,
    saveProduct,
    deleteProduct,
    addInventoryBatch,
    registerSale,
    refresh,
  };

  return (
    <BackendContext.Provider value={value}>{children}</BackendContext.Provider>
  );
}

export function useBackendData() {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error("useBackendData must be used within BackendProvider");
  }

  return context;
}
