// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyRecurring, normalizeState, seedState, STORAGE_KEY } from "./data";
import { todayISO, uid } from "./lib";
import { planFingerprint } from "./planLink";
import { applyReminders } from "./reminders";
import type {
  AppState,
  BankTransaction,
  Company,
  Customer,
  Expense,
  Invoice,
  PaymentPlan,
  Product,
  Quote,
  RecurringInvoice,
  Reminder,
  ReminderLevel,
} from "./types";

interface StoreValue {
  state: AppState;
  updateCompany: (company: Company) => void;
  saveCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  saveInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  saveQuote: (quote: Quote) => void;
  deleteQuote: (id: string) => void;
  saveProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  saveRecurring: (rule: RecurringInvoice) => number;
  deleteRecurring: (id: string) => void;
  runRecurringNow: (id: string) => number;
  generateRecurring: () => number;
  saveExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  markVat: (year: number, quarter: number, submitted: boolean) => void;
  importState: (next: AppState) => void;
  importBankTransactions: (transactions: BankTransaction[]) => number;
  sendReminder: (invoiceId: string, niveau: ReminderLevel, conceptId?: string) => Reminder;
  removeReminder: (id: string) => void;
  dismissReminder: (id: string) => void;
  stageReminders: () => number;
  setAutoReminders: (enabled: boolean) => void;
  savePaymentPlan: (plan: PaymentPlan) => void;
  setPlanPaymentLink: (id: string, betaalLink: string | undefined) => void;
  acceptPaymentPlan: (id: string, acceptedAt: string) => void;
  endPaymentPlan: (id: string) => void;
  matchBankTransaction: (transactionId: string, invoiceId: string) => void;
  unmatchBankTransaction: (transactionId: string) => void;
  setBankTransactionStatus: (transactionId: string, status: "open" | "genegeerd") => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const migrated = normalizeState(JSON.parse(raw));
      if (migrated) return migrated;
    }
  } catch {
    // Fall back to the demo administration when storage is unavailable or corrupt.
  }
  return seedState();
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private previews can block localStorage.
    }
  }, [state]);

  const updateCompany = useCallback((company: Company) => {
    setState((current) => ({ ...current, bedrijf: { ...company } }));
  }, []);

  const saveCustomer = useCallback((customer: Customer) => {
    setState((current) => {
      const exists = current.relaties.some((r) => r.id === customer.id);
      return {
        ...current,
        relaties: exists
          ? current.relaties.map((r) => (r.id === customer.id ? { ...customer } : r))
          : [...current.relaties, { ...customer }],
      };
    });
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      relaties: current.relaties.filter((r) => r.id !== id),
    }));
  }, []);

  const saveInvoice = useCallback((invoice: Invoice) => {
    setState((current) => {
      const exists = current.facturen.some((f) => f.id === invoice.id);
      return {
        ...current,
        facturen: exists
          ? current.facturen.map((f) => (f.id === invoice.id ? { ...invoice } : f))
          : [{ ...invoice }, ...current.facturen],
      };
    });
  }, []);

  const deleteInvoice = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      facturen: current.facturen.filter((f) => f.id !== id),
      offertes: current.offertes.map((quote) =>
        quote.factuurId === id ? { ...quote, factuurId: undefined } : quote
      ),
      banktransacties: current.banktransacties.map((transaction) =>
        transaction.factuurId === id
          ? { ...transaction, status: "open", factuurId: undefined }
          : transaction
      ),
      herinneringen: current.herinneringen.filter((reminder) => reminder.factuurId !== id),
      betaalregelingen: current.betaalregelingen.filter((plan) => plan.factuurId !== id),
    }));
  }, []);

  const saveQuote = useCallback((quote: Quote) => {
    setState((current) => {
      const exists = current.offertes.some((q) => q.id === quote.id);
      return {
        ...current,
        offertes: exists
          ? current.offertes.map((q) => (q.id === quote.id ? { ...quote } : q))
          : [{ ...quote }, ...current.offertes],
      };
    });
  }, []);

  const deleteQuote = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      offertes: current.offertes.filter((q) => q.id !== id),
    }));
  }, []);

  const saveProduct = useCallback((product: Product) => {
    setState((current) => {
      const exists = current.producten.some((p) => p.id === product.id);
      return {
        ...current,
        producten: exists
          ? current.producten.map((p) => (p.id === product.id ? { ...product } : p))
          : [...current.producten, { ...product }],
      };
    });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      producten: current.producten.filter((p) => p.id !== id),
    }));
  }, []);

  const saveRecurring = useCallback(
    (rule: RecurringInvoice) => {
      const exists = state.herhalingen.some((item) => item.id === rule.id);
      const herhalingen = exists
        ? state.herhalingen.map((item) => (item.id === rule.id ? { ...rule } : item))
        : [...state.herhalingen, { ...rule }];
      const result = applyRecurring({ ...state, herhalingen }, { onlyId: rule.id });
      setState(result.state);
      return result.created.length;
    },
    [state]
  );

  const deleteRecurring = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      herhalingen: current.herhalingen.filter((rule) => rule.id !== id),
    }));
  }, []);

  const runRecurringNow = useCallback(
    (id: string) => {
      const result = applyRecurring(state, { onlyId: id, force: true });
      if (result.created.length > 0) setState(result.state);
      return result.created.length;
    },
    [state]
  );

  const generateRecurring = useCallback(() => {
    const result = applyRecurring(state);
    if (result.created.length > 0) setState(result.state);
    return result.created.length;
  }, [state]);

  const saveExpense = useCallback((expense: Expense) => {
    setState((current) => {
      const exists = current.uitgaven.some((u) => u.id === expense.id);
      return {
        ...current,
        uitgaven: exists
          ? current.uitgaven.map((u) => (u.id === expense.id ? { ...expense } : u))
          : [{ ...expense }, ...current.uitgaven],
      };
    });
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      uitgaven: current.uitgaven.filter((u) => u.id !== id),
    }));
  }, []);

  const markVat = useCallback((year: number, quarter: number, submitted: boolean) => {
    setState((current) => {
      const aangiftes = { ...current.aangiftes };
      const key = `${year}-Q${quarter}`;
      if (submitted) aangiftes[key] = { ingediendOp: todayISO() };
      else delete aangiftes[key];
      return { ...current, aangiftes };
    });
  }, []);

  const importState = useCallback((next: AppState) => {
    const normalized = normalizeState(next);
    if (!normalized) return;
    // A restored administration can contain overdue schedules; catch them up right away.
    const caughtUp = applyRecurring(normalized).state;
    setState(applyReminders(caughtUp).state);
  }, []);

  const importBankTransactions = useCallback(
    (transactions: BankTransaction[]) => {
      const existing = new Set(state.banktransacties.map((transaction) => transaction.id));
      const fresh = transactions.filter((transaction) => !existing.has(transaction.id));
      if (fresh.length > 0) {
        setState({ ...state, banktransacties: [...fresh, ...state.banktransacties] });
      }
      return fresh.length;
    },
    [state]
  );

  const matchBankTransaction = useCallback((transactionId: string, invoiceId: string) => {
    setState((current) => {
      const transaction = current.banktransacties.find((item) => item.id === transactionId);
      const invoice = current.facturen.find((item) => item.id === invoiceId);
      if (!transaction || !invoice) return current;
      return {
        ...current,
        banktransacties: current.banktransacties.map((item) =>
          item.id === transactionId
            ? { ...item, status: "gekoppeld", factuurId: invoiceId }
            : item
        ),
        facturen: current.facturen.map((item) =>
          item.id === invoiceId
            ? { ...item, status: "betaald", betaaldOp: transaction.datum }
            : item
        ),
      };
    });
  }, []);

  // Verstuur een brief: een klaargezet voorstel wordt bijgewerkt, anders komt er een nieuw record.
  const sendReminder = useCallback(
    (invoiceId: string, niveau: ReminderLevel, conceptId?: string) => {
      const verzondenOp = todayISO();
      const verzonden: Reminder = {
        id: conceptId ?? `rem-${uid()}`,
        factuurId: invoiceId,
        niveau,
        status: "verzonden",
        aangemaaktOp: verzondenOp,
        verzondenOp,
      };
      setState((current) => {
        const voorstel = conceptId
          ? current.herinneringen.find(
              (reminder) => reminder.id === conceptId && reminder.status === "concept"
            )
          : undefined;
        if (voorstel && voorstel.niveau === niveau) {
          return {
            ...current,
            herinneringen: current.herinneringen.map((reminder) =>
              reminder.id === voorstel.id
                ? { ...reminder, status: "verzonden" as const, verzondenOp }
                : reminder
            ),
          };
        }
        // Ander niveau gekozen of geen voorstel: open voorstellen voor deze factuur vervallen.
        const herinneringen = current.herinneringen.map((reminder) =>
          reminder.status === "concept" && reminder.factuurId === invoiceId && !reminder.genegeerdOp
            ? { ...reminder, genegeerdOp: reminder.genegeerdOp ?? verzondenOp }
            : reminder
        );
        return { ...current, herinneringen: [...herinneringen, verzonden] };
      });
      return verzonden;
    },
    []
  );

  const removeReminder = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      herinneringen: current.herinneringen.filter((reminder) => reminder.id !== id),
    }));
  }, []);

  // Afwijzen: het voorstel verdwijnt uit de lijst en Helder stelt dit niveau niet opnieuw voor.
  const dismissReminder = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      herinneringen: current.herinneringen.map((reminder) =>
        reminder.id === id && reminder.status === "concept"
          ? { ...reminder, genegeerdOp: todayISO() }
          : reminder
      ),
    }));
  }, []);

  const stageReminders = useCallback(() => {
    const result = applyReminders(state);
    if (result.created.length > 0 || result.cleaned > 0 || result.ended > 0) setState(result.state);
    return result.created.length;
  }, [state]);

  // Eén lopende regeling per factuur; oudere afgesloten regelingen blijven als historie staan.
  const savePaymentPlan = useCallback((plan: PaymentPlan) => {
    setState((current) => {
      const bestaat = current.betaalregelingen.some((item) => item.id === plan.id);
      if (bestaat) {
        return {
          ...current,
          betaalregelingen: current.betaalregelingen.map((item) =>
            item.id === plan.id
              ? {
                  ...plan,
                  // Een gewijzigd aflosschema kan niet op het oude akkoord steunen.
                  geaccepteerdOp:
                    planFingerprint(plan) === planFingerprint(item)
                      ? plan.geaccepteerdOp ?? item.geaccepteerdOp
                      : plan.geaccepteerdOp,
                }
              : item
          ),
        };
      }
      // Een nieuwe afspraak sluit de lopende regeling van dezelfde factuur af en blijft als historie staan.
      const vandaag = todayISO();
      return {
        ...current,
        betaalregelingen: [
          ...current.betaalregelingen.map((item) =>
            item.factuurId === plan.factuurId && !item.beeindigdOp
              ? { ...item, beeindigdOp: vandaag }
              : item
          ),
          { ...plan },
        ],
      };
    });
  }, []);

  // De betaallink hoort bij de afspraak, niet bij het akkoord: hem aanpassen mag altijd.
  const setPlanPaymentLink = useCallback((id: string, betaalLink: string | undefined) => {
    setState((current) => ({
      ...current,
      betaalregelingen: current.betaalregelingen.map((plan) =>
        plan.id === id ? { ...plan, betaalLink } : plan
      ),
    }));
  }, []);

  // Het tijdstip komt uit de bevestigingscode van de klant; het eerste akkoord blijft staan.
  const acceptPaymentPlan = useCallback((id: string, acceptedAt: string) => {
    setState((current) => ({
      ...current,
      betaalregelingen: current.betaalregelingen.map((plan) =>
        plan.id === id ? { ...plan, geaccepteerdOp: plan.geaccepteerdOp ?? acceptedAt } : plan
      ),
    }));
  }, []);

  const endPaymentPlan = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      betaalregelingen: current.betaalregelingen.map((plan) =>
        plan.id === id ? { ...plan, beeindigdOp: todayISO() } : plan
      ),
    }));
  }, []);

  const setAutoReminders = useCallback((enabled: boolean) => {
    setState((current) => ({ ...current, autoAanmaningen: enabled }));
  }, []);

  const unmatchBankTransaction = useCallback((transactionId: string) => {
    setState((current) => {
      const transaction = current.banktransacties.find((item) => item.id === transactionId);
      if (!transaction?.factuurId) return current;
      const invoiceId = transaction.factuurId;
      return {
        ...current,
        banktransacties: current.banktransacties.map((item) =>
          item.id === transactionId
            ? { ...item, status: "open", factuurId: undefined }
            : item
        ),
        facturen: current.facturen.map((item) =>
          item.id === invoiceId && item.status === "betaald"
            ? { ...item, status: "verzonden", betaaldOp: undefined }
            : item
        ),
      };
    });
  }, []);

  const setBankTransactionStatus = useCallback(
    (transactionId: string, status: "open" | "genegeerd") => {
      setState((current) => ({
        ...current,
        banktransacties: current.banktransacties.map((item) =>
          item.id === transactionId ? { ...item, status } : item
        ),
      }));
    },
    []
  );

  const reset = useCallback(() => {
    setState(seedState());
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      updateCompany,
      saveCustomer,
      deleteCustomer,
      saveInvoice,
      deleteInvoice,
      saveQuote,
      deleteQuote,
      saveProduct,
      deleteProduct,
      saveRecurring,
      deleteRecurring,
      runRecurringNow,
      generateRecurring,
      saveExpense,
      deleteExpense,
      markVat,
      importState,
      importBankTransactions,
      sendReminder,
      removeReminder,
      dismissReminder,
      stageReminders,
      setAutoReminders,
      savePaymentPlan,
      setPlanPaymentLink,
      acceptPaymentPlan,
      endPaymentPlan,
      matchBankTransaction,
      unmatchBankTransaction,
      setBankTransactionStatus,
      reset,
    }),
    [
      state,
      updateCompany,
      saveCustomer,
      deleteCustomer,
      saveInvoice,
      deleteInvoice,
      saveQuote,
      deleteQuote,
      saveProduct,
      deleteProduct,
      saveRecurring,
      deleteRecurring,
      runRecurringNow,
      generateRecurring,
      saveExpense,
      deleteExpense,
      markVat,
      importState,
      importBankTransactions,
      sendReminder,
      removeReminder,
      dismissReminder,
      stageReminders,
      setAutoReminders,
      savePaymentPlan,
      setPlanPaymentLink,
      acceptPaymentPlan,
      endPaymentPlan,
      matchBankTransaction,
      unmatchBankTransaction,
      setBankTransactionStatus,
      reset,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useAppStore must be used inside AppStoreProvider");
  return context;
}
