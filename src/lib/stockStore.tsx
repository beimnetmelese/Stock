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
  analyticsTables as mockAnalyticsTables,
  inventoryBatches as seedInventoryBatches,
  lowStockAlerts as seedLowStockAlerts,
  products as seedProducts,
  recentSales as seedRecentSales,
  salesHistory as seedSalesHistory,
  type CartItem,
  type Product,
  type SalesHistoryRecord,
} from "../data/mockData";
import {
  deleteRows,
  hasSupabaseConfig,
  insertRows,
  rpcCall,
  selectRows,
  updateRows,
} from "./supabase";

export type InventoryBatch = (typeof seedInventoryBatches)[number];
export type SalesItem = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

export type ProductDraft = {
  name: string;
  sku: string;
  category: string;
  description: string;
  stock: number;
  price: number;
  cost: number;
  image: string;
};

export type InventoryBatchDraft = {
  product_id: string;
  supplier: string;
  quantity: number;
  unit_cost: number;
  purchase_date: string;
};

type StockStoreContextValue = {
  isLoading: boolean;
  products: Product[];
  inventoryBatches: InventoryBatch[];
  salesHistory: SalesHistoryRecord[];
  recentSales: typeof seedRecentSales;
  lowStockAlerts: typeof seedLowStockAlerts;
  addProduct: (draft: ProductDraft) => Promise<void>;
  updateProduct: (id: number, draft: ProductDraft) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  addInventoryBatch: (draft: InventoryBatchDraft) => Promise<void>;
  registerSale: (input: {
    customer: string;
    paymentMethod: "Cash" | "Card" | "Mobile Money" | "Bank Transfer";
    items: CartItem[];
  }) => Promise<void>;
  refreshData: () => Promise<void>;
  isSupabaseConfigured: boolean;
};

const StockStoreContext = createContext<StockStoreContextValue | null>(null);

const productStatus = (stock: number) => {
  if (stock <= 0) return "Out of Stock" as const;
  if (stock <= 15) return "Low Stock" as const;
  return "In Stock" as const;
};

const mapToProduct = (row: any): Product => ({
  id: Number(row.id),
  name: row.name,
  sku: row.sku,
  category: row.category,
  stock: Number(row.stock),
  status: row.status ?? productStatus(Number(row.stock)),
  price: Number(row.price ?? 0),
  cost: Number(row.cost ?? 0),
  image: row.image_url ?? row.image ?? seedProducts[0].image,
  description: row.description ?? "",
});

async function fetchProducts(): Promise<Product[]> {
  if (!hasSupabaseConfig()) return seedProducts;

  const data = await selectRows<any>("products", "*");
  return (data ?? []).map(mapToProduct);
}

async function fetchInventoryBatches(): Promise<InventoryBatch[]> {
  if (!hasSupabaseConfig()) return seedInventoryBatches;

  const data = await selectRows<any>(
    "inventory_batches",
    "id, quantity, unit_cost, remaining_stock, purchase_date, products(name)",
  );

  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    product: row.products?.name ?? row.product_name ?? "",
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    remainingStock: Number(row.remaining_stock),
    purchaseDate: row.purchase_date,
  }));
}

async function fetchSalesHistory(): Promise<SalesHistoryRecord[]> {
  if (!hasSupabaseConfig()) return seedSalesHistory;

  const data = await selectRows<any>(
    "sales",
    "id, sale_no, customer, sale_date, payment_method, total_amount, status, sale_items(quantity)",
  );

  return (data ?? []).map((row: any) => ({
    id: row.sale_no ?? row.id,
    customer: row.customer ?? "",
    date: (row.sale_date ?? "").slice(0, 10),
    items:
      row.sale_items?.reduce(
        (sum: number, item: any) => sum + Number(item.quantity),
        0,
      ) ?? 0,
    paymentMethod: row.payment_method ?? "Cash",
    amount: Number(row.total_amount ?? 0),
    status: row.status ?? "Completed",
  }));
}

export function StockStoreProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [inventoryBatches, setInventoryBatches] =
    useState<InventoryBatch[]>(seedInventoryBatches);
  const [salesHistory, setSalesHistory] =
    useState<SalesHistoryRecord[]>(seedSalesHistory);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextProducts, nextBatches, nextSales] = await Promise.all([
        fetchProducts(),
        fetchInventoryBatches(),
        fetchSalesHistory(),
      ]);
      setProducts(nextProducts);
      setInventoryBatches(nextBatches);
      setSalesHistory(nextSales);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const persistProducts = async (nextProducts: Product[]) => {
    setProducts(nextProducts);
    if (!hasSupabaseConfig()) return;

    const existingIds = new Set(products.map((product) => product.id));
    await Promise.all(
      nextProducts.map((product) => {
        const row = {
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          description: product.description,
          stock: product.stock,
          price: product.price,
          cost: product.cost,
          image_url: product.image,
          status: productStatus(product.stock),
        };

        return existingIds.has(product.id)
          ? updateRows("products", row, { id: product.id })
          : insertRows("products", row);
      }),
    );
  };

  const persistBatches = async (nextBatches: InventoryBatch[]) => {
    setInventoryBatches(nextBatches);
    if (!hasSupabaseConfig()) return;

    const existingIds = new Set(inventoryBatches.map((batch) => batch.id));
    await Promise.all(
      nextBatches.map((batch) => {
        const row = {
          id: batch.id,
          quantity: batch.quantity,
          unit_cost: batch.unitCost,
          remaining_stock: batch.remainingStock,
          purchase_date: batch.purchaseDate,
        };

        return existingIds.has(batch.id)
          ? updateRows("inventory_batches", row, { id: batch.id })
          : insertRows("inventory_batches", row);
      }),
    );
  };

  const addProduct = useCallback(
    async (draft: ProductDraft) => {
      const nextProduct: Product = {
        id: Date.now(),
        name: draft.name,
        sku: draft.sku,
        category: draft.category,
        stock: draft.stock,
        status: productStatus(draft.stock),
        price: draft.price,
        cost: draft.cost,
        image: draft.image,
        description: draft.description,
      };

      const nextProducts = [...products, nextProduct];
      await persistProducts(nextProducts);
    },
    [products],
  );

  const updateProduct = useCallback(
    async (id: number, draft: ProductDraft) => {
      const nextProducts = products.map((product) =>
        product.id === id
          ? { ...product, ...draft, status: productStatus(draft.stock) }
          : product,
      );
      await persistProducts(nextProducts);
    },
    [products],
  );

  const deleteProduct = useCallback(
    async (id: number) => {
      const nextProducts = products.filter((product) => product.id !== id);
      await persistProducts(nextProducts);
      if (hasSupabaseConfig()) {
        await deleteRows("products", { id });
      }
    },
    [products],
  );

  const addInventoryBatch = useCallback(
    async (draft: InventoryBatchDraft) => {
      const nextBatch: InventoryBatch = {
        id: Date.now(),
        product:
          products.find((product) => String(product.id) === draft.product_id)
            ?.name ?? "",
        quantity: draft.quantity,
        unitCost: draft.unit_cost,
        remainingStock: draft.quantity,
        purchaseDate: draft.purchase_date,
      };

      await persistBatches([...inventoryBatches, nextBatch]);
    },
    [inventoryBatches, products],
  );

  const registerSale = useCallback(
    async (input: {
      customer: string;
      paymentMethod: "Cash" | "Card" | "Mobile Money" | "Bank Transfer";
      items: CartItem[];
    }) => {
      if (hasSupabaseConfig()) {
        await rpcCall("record_sale", {
          p_customer: input.customer,
          p_payment_method: input.paymentMethod,
          p_items: input.items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
          })),
        });
        await refreshData();
        return;
      }

      const nextProducts = products.map((product) => {
        const sold = input.items.find((item) => item.id === product.id);
        return sold
          ? {
              ...product,
              stock: Math.max(0, product.stock - sold.quantity),
              status: productStatus(product.stock - sold.quantity),
            }
          : product;
      });

      const nextBatches = [...inventoryBatches];
      input.items.forEach((item) => {
        let remaining = item.quantity;
        nextBatches
          .filter(
            (batch) =>
              batch.product ===
              products.find((product) => product.id === item.id)?.name,
          )
          .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate))
          .forEach((batch) => {
            if (remaining <= 0) return;
            const take = Math.min(batch.remainingStock, remaining);
            batch.remainingStock -= take;
            remaining -= take;
          });
      });

      const saleAmount = input.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const saleRecord: SalesHistoryRecord = {
        id: `SA-${Date.now()}`,
        customer: input.customer,
        date: new Date().toISOString().slice(0, 10),
        items: input.items.reduce((sum, item) => sum + item.quantity, 0),
        paymentMethod: input.paymentMethod,
        amount: saleAmount,
        status: "Completed",
      };

      setProducts(nextProducts);
      setInventoryBatches(nextBatches);
      setSalesHistory((current) => [saleRecord, ...current]);
    },
    [inventoryBatches, products, refreshData],
  );

  const value = useMemo<StockStoreContextValue>(
    () => ({
      isLoading,
      products,
      inventoryBatches,
      salesHistory,
      recentSales: salesHistory.slice(0, 4).map((sale) => ({
        id: sale.id,
        customer: sale.customer,
        amount: sale.amount,
        items: sale.items,
        status: sale.status,
      })),
      lowStockAlerts: products
        .filter((product) => product.status !== "In Stock")
        .slice(0, 3)
        .map((product) => ({
          name: product.name,
          stock: product.stock,
          limit: product.status === "Out of Stock" ? 0 : 15,
        })),
      addProduct,
      updateProduct,
      deleteProduct,
      addInventoryBatch,
      registerSale,
      refreshData,
      isSupabaseConfigured: hasSupabaseConfig(),
    }),
    [
      addInventoryBatch,
      addProduct,
      deleteProduct,
      inventoryBatches,
      isLoading,
      products,
      registerSale,
      refreshData,
      salesHistory,
      updateProduct,
    ],
  );

  return (
    <StockStoreContext.Provider value={value}>
      {children}
    </StockStoreContext.Provider>
  );
}

export function useStockStore() {
  const context = useContext(StockStoreContext);
  if (!context) {
    throw new Error("useStockStore must be used within StockStoreProvider");
  }
  return context;
}

export function deriveDashboardMetrics(params: {
  salesHistory: SalesHistoryRecord[];
  products: Product[];
  inventoryBatches: InventoryBatch[];
  range: "today" | "7d" | "30d" | "1y" | "custom";
}) {
  const now = new Date();
  const start = new Date();
  if (params.range === "today") start.setDate(now.getDate());
  if (params.range === "7d") start.setDate(now.getDate() - 7);
  if (params.range === "30d") start.setDate(now.getDate() - 30);
  if (params.range === "1y") start.setFullYear(now.getFullYear() - 1);
  if (params.range === "custom") start.setDate(now.getDate() - 30);

  const filteredSales = params.salesHistory.filter(
    (sale) => new Date(sale.date) >= start,
  );

  return {
    revenue: filteredSales.reduce((sum, sale) => sum + sale.amount, 0),
    profit: Math.round(
      filteredSales.reduce((sum, sale) => sum + sale.amount * 0.28, 0),
    ),
    inventoryValue: Math.round(
      params.inventoryBatches.reduce(
        (sum, batch) => sum + batch.remainingStock * batch.unitCost,
        0,
      ),
    ),
    totalProducts: params.products.length,
    lowStockProducts: params.products.filter(
      (product) => product.status !== "In Stock",
    ).length,
    dailySales: filteredSales.reduce((sum, sale) => sum + sale.items, 0),
  };
}

export { mockAnalyticsTables };
