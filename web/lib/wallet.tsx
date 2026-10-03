"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CHAIN_ID, EXPLORER_URL, RPC_URL, chain } from "./chain";

export type InjectedProvider = {
  request: (request: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export type WalletOption = {
  id: string;
  name: string;
  provider: InjectedProvider;
};

type Announcement = {
  info: { uuid: string; name: string };
  provider: InjectedProvider;
};

type WalletState = {
  options: WalletOption[];
  provider: InjectedProvider | null;
  address: `0x${string}` | null;
  networkReady: boolean;
  connecting: boolean;
  error: string;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  rescan: () => void;
  connect: (option: WalletOption) => Promise<void>;
  disconnect: () => void;
  ensureNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);
const SAVED_WALLET = "episode.wallet";
const expectedChain = `0x${CHAIN_ID.toString(16)}`;

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return "The wallet could not complete the request.";
}

function chainMatches(value: unknown): boolean {
  return typeof value === "string" && Number.parseInt(value, 16) === CHAIN_ID;
}

/** Change the selected wallet's chain, using this app's configured RPC. */
export async function selectNetwork(provider: InjectedProvider): Promise<void> {
  if (chainMatches(await provider.request({ method: "eth_chainId" }))) return;

  const switchChain = () => provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: expectedChain }],
  });
  try {
    await switchChain();
  } catch (error) {
    if ((error as { code?: number })?.code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: expectedChain,
        chainName: chain.name,
        rpcUrls: [RPC_URL],
        nativeCurrency: chain.nativeCurrency,
        ...(EXPLORER_URL ? { blockExplorerUrls: [EXPLORER_URL] } : {}),
      }],
    });
    await switchChain();
  }
  if (!chainMatches(await provider.request({ method: "eth_chainId" }))) {
    throw new Error(`Switch your wallet to ${chain.name} to continue.`);
  }
}

function validAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function WalletSession({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [selected, setSelected] = useState<WalletOption | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [networkReady, setNetworkReady] = useState(false);
  const [discovering, setDiscovering] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const rescan = useCallback(() => {
    setDiscovering(true);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => {
      const legacy = (window as Window & { ethereum?: InjectedProvider }).ethereum;
      if (legacy) {
        setOptions((current) => current.some((item) => item.provider === legacy)
          ? current
          : [...current, { id: "injected", name: "Browser wallet", provider: legacy }]);
      }
      setDiscovering(false);
    }, 300);
  }, []);

  useEffect(() => {
    const onAnnouncement = (event: Event) => {
      const detail = (event as CustomEvent<Announcement>).detail;
      if (!detail?.provider?.request || !detail.info?.uuid) return;
      setOptions((current) => {
        const existing = current.find((item) => item.provider === detail.provider);
        if (existing) return existing.id === "injected"
          ? current.map((item) => item === existing ? { ...item, name: detail.info.name || item.name } : item)
          : current;
        return [...current, {
          id: detail.info.uuid,
          name: detail.info.name || "Wallet",
          provider: detail.provider,
        }];
      });
    };
    window.addEventListener("eip6963:announceProvider", onAnnouncement);
    rescan();
    return () => window.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }, [rescan]);

  const disconnect = useCallback(() => {
    setSelected(null);
    setAddress(null);
    setNetworkReady(false);
    setError("");
    window.localStorage.removeItem(SAVED_WALLET);
  }, []);

  const connect = useCallback(async (option: WalletOption) => {
    setConnecting(true);
    setError("");
    try {
      const accounts = await option.provider.request({ method: "eth_requestAccounts" });
      const first = Array.isArray(accounts) ? accounts[0] : null;
      if (!validAddress(first)) throw new Error("The wallet returned no valid account.");
      await selectNetwork(option.provider);
      setSelected(option);
      setAddress(first);
      setNetworkReady(true);
      setPickerOpen(false);
      window.localStorage.setItem(SAVED_WALLET, option.id);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    const remembered = window.localStorage.getItem(SAVED_WALLET);
    const option = options.find((item) => item.id === remembered);
    if (!option || selected) return;
    let active = true;
    void (async () => {
      try {
        const accounts = await option.provider.request({ method: "eth_accounts" });
        const first = Array.isArray(accounts) ? accounts[0] : null;
        if (!active || !validAddress(first)) return;
        const currentChain = await option.provider.request({ method: "eth_chainId" });
        if (!active) return;
        setSelected(option);
        setAddress(first);
        setNetworkReady(chainMatches(currentChain));
      } catch {
        // A remembered wallet can be locked or no longer authorised.
      }
    })();
    return () => { active = false; };
  }, [options, selected]);

  useEffect(() => {
    const provider = selected?.provider;
    if (!provider?.on) return;
    const accountsChanged = (...args: unknown[]) => {
      const accounts = args[0];
      const first = Array.isArray(accounts) ? accounts[0] : null;
      if (validAddress(first)) setAddress(first);
      else disconnect();
    };
    const chainChanged = (...args: unknown[]) => setNetworkReady(chainMatches(args[0]));
    provider.on("accountsChanged", accountsChanged);
    provider.on("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [selected, disconnect]);

  const ensureNetwork = useCallback(async () => {
    if (!selected) throw new Error("Connect a wallet first.");
    await selectNetwork(selected.provider);
    setNetworkReady(true);
  }, [selected]);

  const value = useMemo<WalletState>(() => ({
    options,
    provider: selected?.provider ?? null,
    address,
    networkReady,
    connecting,
    error,
    pickerOpen,
    openPicker: () => { setError(""); rescan(); setPickerOpen(true); },
    closePicker: () => setPickerOpen(false),
    rescan,
    connect,
    disconnect,
    ensureNetwork,
  }), [options, selected, address, networkReady, connecting, error, pickerOpen, rescan, connect, disconnect, ensureNetwork]);

  return <WalletContext.Provider value={value}>
    {children}
    {pickerOpen && <WalletPickerView
      options={options}
      discovering={discovering}
      connecting={connecting}
      error={error}
      onClose={() => setPickerOpen(false)}
      onRescan={rescan}
      onConnect={connect}
    />}
  </WalletContext.Provider>;
}

export function WalletPickerView({
  options, discovering, connecting, error, onClose, onRescan, onConnect,
}: {
  options: WalletOption[];
  discovering: boolean;
  connecting: boolean;
  error: string;
  onClose: () => void;
  onRescan: () => void;
  onConnect: (option: WalletOption) => Promise<void>;
}) {
  return <div className="wallet-shade" onMouseDown={onClose}>
      <section
        className="wallet-dialog sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-title"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
      >
        <div className="wallet-dialog-heading">
          <div>
            <p className="marginal">Account access</p>
            <h2 id="wallet-title">Choose a wallet</h2>
          </div>
          <button type="button" className="press" onClick={onClose} aria-label="Close wallet chooser" autoFocus>close</button>
        </div>
        <p className="wallet-hint">Connect an installed wallet to sign Episode transactions on {chain.name}.</p>
        {error && <p className="wallet-error" role="alert">{error}</p>}
        {discovering && options.length === 0 ? <p className="wallet-hint" role="status">Searching for browser wallets…</p>
          : options.length === 0 ? <div className="wallet-empty">
          <p>No browser wallet was found.</p>
          <a href="https://metamask.io/download" target="_blank" rel="noreferrer" className="press press-filled">Get a compatible wallet</a>
          <button type="button" className="press" onClick={onRescan}>search again</button>
        </div> : <div className="wallet-options">
          {options.map((option) => <button
            key={option.id}
            type="button"
            className="wallet-option"
            disabled={connecting}
            onClick={() => void onConnect(option)}
          >
            <span className="wallet-option-mark" aria-hidden="true">{option.name.slice(0, 1).toUpperCase()}</span>
            <span>{option.name}</span>
            <span className="wallet-option-action">{connecting ? "waiting…" : "connect"}</span>
          </button>)}
        </div>}
      </section>
    </div>;
}

export function useWallet(): WalletState {
  const state = useContext(WalletContext);
  if (!state) throw new Error("WalletSession is required for wallet actions.");
  return state;
}
