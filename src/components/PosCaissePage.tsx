import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, fmtDA } from '../api.ts';

export interface Ticket80Props {
  bon: any;
  profil?: any;
  onClose: () => void;
}

export function Ticket80mmModal({ bon, profil, onClose }: Ticket80Props) {
  useEffect(() => {
    document.body.classList.add('ticket80-active');
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('ticket80-active');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (!bon) return null;

  const totalTTC = Number(bon.total_ttc ?? bon.total ?? 0);
  const montantVerse = Number(bon.montant_verse ?? 0);
  const montantRecu =
    bon.montant_recu !== undefined && bon.montant_recu !== null
      ? Number(bon.montant_recu)
      : montantVerse;
  const renduMonnaie =
    bon.rendu_monnaie !== undefined && bon.rendu_monnaie !== null
      ? Number(bon.rendu_monnaie)
      : Math.max(0, Number((montantRecu - totalTTC).toFixed(2)));
  const restePayer = Number(
    bon.reste_payer ?? Math.max(0, totalTTC - montantVerse)
  );
  const remiseMontant = Number(bon.remise_montant || 0);
  const lignes = Array.isArray(bon.lignes) ? bon.lignes : [];
  const totalUnites = lignes.reduce(
    (acc: number, l: any) => acc + Number(l.quantite || 0),
    0
  );
  const sousTotalBrut = lignes.reduce(
    (acc: number, l: any) => acc + Number(l.total || 0),
    0
  );
  const rc = profil?.registre_commerce || profil?.nrc || '';

  return createPortal(
    <div className="modal-backdrop ticket80-backdrop">
      <div className="modal-panel ticket80-modal">
        <div className="ticket80-sheet">
          {/* Entête Entreprise */}
          <div className="ticket80-header">
            {profil?.logo_data && (
              <img
                src={profil.logo_data}
                alt="Logo"
                style={{
                  maxHeight: 42,
                  maxWidth: 140,
                  objectFit: 'contain',
                  margin: '0 auto 4px',
                  display: 'block',
                }}
              />
            )}
            <div className="ticket80-company">
              {profil?.forme_juridique ? `${profil.forme_juridique} ` : ''}
              {profil?.nom || 'GESTION STOCK'}
            </div>
            {profil?.activite && (
              <div className="ticket80-small">{profil.activite}</div>
            )}
            {(profil?.adresse || profil?.ville) && (
              <div className="ticket80-small">
                {[profil?.adresse, profil?.ville].filter(Boolean).join(' — ')}
              </div>
            )}
            {profil?.telephone && (
              <div className="ticket80-small">Tél : {profil.telephone}</div>
            )}
            {(profil?.nif || rc || profil?.art_imp) && (
              <div className="ticket80-small">
                {[
                  profil?.nif ? `NIF:${profil.nif}` : '',
                  rc ? `RC:${rc}` : '',
                  profil?.art_imp ? `AI:${profil.art_imp}` : '',
                ]
                  .filter(Boolean)
                  .join(' | ')}
              </div>
            )}
          </div>

          <div className="ticket80-divider" />

          {/* Infos Ticket */}
          <div className="ticket80-meta">
            <div className="ticket80-title">TICKET N° {bon.numero}</div>
            <div>Date : {bon.date_bon}</div>
            <div>Client : {bon.client_nom || 'Client Comptoir'}</div>
            {bon.caissier_nom && <div>Caissier : {bon.caissier_nom}</div>}
            {bon.mode_reglement && (
              <div>Règlement : {bon.mode_reglement}</div>
            )}
          </div>

          <div className="ticket80-divider" />

          {/* En-tête Colonnes Articles */}
          <div className="ticket80-cols-head">
            <span>Désignation / Qté x PU</span>
            <span>Montant</span>
          </div>

          {/* Articles */}
          <div className="ticket80-items">
            {lignes.map((l: any, idx: number) => (
              <div key={l.id || idx} className="ticket80-item">
                <div className="ticket80-item-name">{l.designation}</div>
                <div className="ticket80-item-row">
                  <span>
                    {Number(l.quantite)} x {fmtDA(l.prix_unitaire)}
                    {Number(l.remise || 0) > 0
                      ? ` (-${fmtDA(l.remise)})`
                      : ''}
                  </span>
                  <strong>{fmtDA(l.total)}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="ticket80-divider" />

          {/* Totaux & Règlement */}
          <div className="ticket80-totals">
            <div className="ticket80-row ticket80-small">
              <span>
                Articles : {lignes.length} · Unités : {totalUnites}
              </span>
              <span>{bon.statut || 'Validé'}</span>
            </div>

            {remiseMontant > 0 && (
              <>
                <div className="ticket80-row">
                  <span>Sous-total</span>
                  <span>{fmtDA(sousTotalBrut)}</span>
                </div>
                <div className="ticket80-row">
                  <span>Remise globale</span>
                  <span>-{fmtDA(remiseMontant)}</span>
                </div>
              </>
            )}

            <div className="ticket80-row ticket80-grand-total">
              <span>TOTAL TTC</span>
              <span>{fmtDA(totalTTC)}</span>
            </div>

            <div className="ticket80-row">
              <span>Montant reçu</span>
              <span>{fmtDA(montantRecu)}</span>
            </div>

            {renduMonnaie > 0 && (
              <div className="ticket80-row ticket80-change">
                <span>RENDU MONNAIE</span>
                <span>{fmtDA(renduMonnaie)}</span>
              </div>
            )}

            {montantRecu !== montantVerse && (
              <div className="ticket80-row ticket80-small">
                <span>Encaissé net</span>
                <span>{fmtDA(montantVerse)}</span>
              </div>
            )}

            {restePayer > 0 && (
              <div className="ticket80-row" style={{ fontWeight: 700 }}>
                <span>Reste à payer</span>
                <span>{fmtDA(restePayer)}</span>
              </div>
            )}
          </div>

          <div className="ticket80-divider" />

          <div className="ticket80-footer">
            <div>{profil?.pied_page || 'Merci pour votre visite !'}</div>
            <div style={{ marginTop: 3 }}>À très bientôt</div>
          </div>
        </div>

        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 12,
          }}
        >
          <button
            type="button"
            className="btn btn-green"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => window.print()}
          >
            🖨 Imprimer Ticket 80 mm
          </button>
          <button type="button" className="btn btn-muted" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface CartLine {
  produit_id: number;
  code: string;
  barcode?: string | null;
  designation: string;
  unite: string;
  stock_actuel: number;
  quantite: number;
  prix_unitaire: number;
  remise: number;
  niveau_prix: string;
  tva: number;
}

export function PosCaissePage({
  token,
  userRole,
  onNavigate,
}: {
  token: string;
  userRole?: string;
  onNavigate: (key: string) => void;
}) {
  const isReadOnly = userRole === 'lecture_seule';
  const scannerRef = useRef<HTMLInputElement | null>(null);
  const recuRef = useRef<HTMLInputElement | null>(null);

  const [produits, setProduits] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [prixSpeciaux, setPrixSpeciaux] = useState<any[]>([]);
  const [activeProfil, setActiveProfil] = useState<any>(null);
  const [recentBons, setRecentBons] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  // Catalog filters & scanner
  const [scanQuery, setScanQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'tous' | 'dispo' | 'alerte'>(
    'tous'
  );
  const [marqueFilter, setMarqueFilter] = useState('Toutes');

  // Cart & Payment state
  const [clientId, setClientId] = useState<number>(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [remiseType, setRemiseType] = useState<'aucune' | 'montant' | 'pourcentage'>(
    'aucune'
  );
  const [remiseVal, setRemiseVal] = useState<string>('0');
  const [modeReglement, setModeReglement] = useState<string>('Espèces');
  const [montantRecuStr, setMontantRecuStr] = useState<string>('0');
  const [montantRecuTouched, setMontantRecuTouched] = useState<boolean>(false);
  const [autoPrintTicket, setAutoPrintTicket] = useState<boolean>(true);
  const [forcerPlafond, setForcerPlafond] = useState<boolean>(false);
  const [observations, setObservations] = useState<string>('Vente comptoir POS');
  const [ticketBon, setTicketBon] = useState<any>(null);

  const loadPosData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, cls, profil, bons, ps] = await Promise.all([
        apiFetch<any[]>('/api/bureau/produits', { token }),
        apiFetch<any[]>('/api/bureau/clients', { token }),
        apiFetch<any>('/api/bureau/profil-actif', { token }).catch(() => null),
        apiFetch<any[]>('/api/bureau/bons-vente', { token }).catch(() => []),
        apiFetch<any[]>('/api/bureau/prix-speciaux', { token }).catch(() => []),
      ]);
      const activeProds = (Array.isArray(prods) ? prods : []).filter(
        (p) => p.actif !== 0 && p.supprime !== 1
      );
      setProduits(activeProds);
      const clsArr = Array.isArray(cls) ? cls : [];
      setClients(clsArr);
      setActiveProfil(profil);
      setRecentBons((Array.isArray(bons) ? bons : []).slice(0, 6));
      setPrixSpeciaux(Array.isArray(ps) ? ps : []);

      setClientId((prev) => {
        if (clsArr.some((c) => c.id === prev)) return prev;
        const comptoir = clsArr.find((c) => c.code === 'CLT-COMPTOIR');
        return comptoir?.id || clsArr[0]?.id || 1;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement caisse POS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosData();
  }, [token]);

  useEffect(() => {
    if (!loading) {
      scannerRef.current?.focus();
    }
  }, [loading]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) || null,
    [clients, clientId]
  );

  const resolvePriceForClient = (prod: any, targetClientId: number): number => {
    const today = new Date().toISOString().slice(0, 10);
    const sp = prixSpeciaux.find(
      (x) =>
        x.client_id === targetClientId &&
        x.produit_id === prod.id &&
        x.actif !== 0 &&
        (!x.date_debut || x.date_debut <= today) &&
        (!x.date_fin || x.date_fin >= today)
    );
    if (sp && Number(sp.prix_special) > 0) return Number(sp.prix_special);

    const cl = clients.find((c) => c.id === targetClientId);
    const niv = cl?.niveau_prix || 'detail';
    if (niv === 'super_gros' && Number(prod.prix_super_gros) > 0) {
      return Number(prod.prix_super_gros);
    }
    if (niv === 'gros' && Number(prod.prix_gros) > 0) {
      return Number(prod.prix_gros);
    }
    if (niv === 'special' && Number(prod.prix_special) > 0) {
      return Number(prod.prix_special);
    }
    return Number(prod.prix_detail || prod.prix_vente || 0);
  };

  const handleClientChange = (newId: number) => {
    setClientId(newId);
    setForcerPlafond(false);
    const cl = clients.find((c) => c.id === newId);
    const niv = cl?.niveau_prix || 'detail';
    setCart((prev) =>
      prev.map((line) => {
        const prod = produits.find((p) => p.id === line.produit_id);
        if (!prod) return line;
        return {
          ...line,
          prix_unitaire: resolvePriceForClient(prod, newId),
          niveau_prix: niv,
        };
      })
    );
  };

  const showQuickFlash = (msg: string) => {
    setFlashMsg(msg);
  };

  const addProductToCart = (prod: any, qtyToAdd = 1) => {
    if (!prod) return;
    const pu = resolvePriceForClient(prod, clientId);
    const niv = selectedClient?.niveau_prix || 'detail';
    setCart((prev) => {
      const existing = prev.find((l) => l.produit_id === prod.id);
      if (existing) {
        return prev.map((l) =>
          l.produit_id === prod.id
            ? { ...l, quantite: Number((l.quantite + qtyToAdd).toFixed(4)) }
            : l
        );
      }
      return [
        ...prev,
        {
          produit_id: prod.id,
          code: prod.code,
          barcode: prod.barcode,
          designation: prod.designation,
          unite: prod.unite || 'Pcs',
          stock_actuel: Number(prod.stock_actuel || 0),
          quantite: qtyToAdd,
          prix_unitaire: pu,
          remise: 0,
          niveau_prix: niv,
          tva: Number(prod.tva || 0),
        },
      ];
    });
    showQuickFlash(`+ ${qtyToAdd} × ${prod.designation}`);
    scannerRef.current?.focus();
  };

  const updateCartQty = (produitId: number, nextQty: number) => {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((l) => l.produit_id !== produitId));
      return;
    }
    setCart((prev) =>
      prev.map((l) =>
        l.produit_id === produitId
          ? { ...l, quantite: Number(nextQty.toFixed(4)) }
          : l
      )
    );
  };

  const updateCartPrice = (produitId: number, nextPu: number) => {
    setCart((prev) =>
      prev.map((l) =>
        l.produit_id === produitId
          ? { ...l, prix_unitaire: Math.max(0, nextPu) }
          : l
      )
    );
  };

  const brutTTC = useMemo(
    () =>
      cart.reduce(
        (acc, l) =>
          acc + Math.max(0, Number((l.quantite * l.prix_unitaire - l.remise).toFixed(2))),
        0
      ),
    [cart]
  );

  const remiseNum = Math.max(0, Number(remiseVal || 0));
  const remiseMontant = useMemo(() => {
    if (remiseType === 'pourcentage') {
      return Number(((brutTTC * Math.min(100, remiseNum)) / 100).toFixed(2));
    }
    if (remiseType === 'montant') {
      return Number(Math.min(brutTTC, remiseNum).toFixed(2));
    }
    return 0;
  }, [brutTTC, remiseType, remiseNum]);

  const totalTTC = useMemo(
    () => Math.max(0, Number((brutTTC - remiseMontant).toFixed(2))),
    [brutTTC, remiseMontant]
  );

  useEffect(() => {
    if (!montantRecuTouched) {
      setMontantRecuStr(totalTTC > 0 ? String(totalTTC) : '0');
    }
  }, [totalTTC, montantRecuTouched]);

  const montantRecu = Math.max(0, Number(montantRecuStr || 0));
  const montantVerse = Number(Math.min(totalTTC, montantRecu).toFixed(2));
  const renduMonnaie = Math.max(0, Number((montantRecu - totalTTC).toFixed(2)));
  const restePayer = Math.max(0, Number((totalTTC - montantVerse).toFixed(2)));

  const creditAlert = useMemo(() => {
    if (!selectedClient || selectedClient.code === 'CLT-COMPTOIR') return null;
    const plafond = Math.max(0, Number(selectedClient.plafond_credit || 0));
    if (plafond <= 0 || restePayer <= 0) return null;
    const soldeActuel = Number(selectedClient.solde || 0);
    const soldeProjete = Number((soldeActuel + restePayer).toFixed(2));
    if (soldeProjete <= plafond) return null;
    const depassement = Number((soldeProjete - plafond).toFixed(2));
    return {
      plafond,
      soldeActuel,
      soldeProjete,
      depassement,
      bloquant: Number(selectedClient.bloquer_si_depasse || 0) === 1,
    };
  }, [selectedClient, restePayer]);

  const marques = useMemo(
    () =>
      Array.from(
        new Set(produits.map((p) => p.marque).filter(Boolean))
      ).sort(),
    [produits]
  );

  const filteredProducts = useMemo(() => {
    const q = scanQuery.trim().toLowerCase();
    return produits
      .filter((p) => {
        if (stockFilter === 'dispo' && Number(p.stock_actuel || 0) <= 0) {
          return false;
        }
        if (
          stockFilter === 'alerte' &&
          Number(p.stock_actuel || 0) > Number(p.stock_min || 0)
        ) {
          return false;
        }
        if (marqueFilter !== 'Toutes' && p.marque !== marqueFilter) {
          return false;
        }
        if (!q) return true;
        return (
          (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
          (p.code && String(p.code).toLowerCase().includes(q)) ||
          (p.designation && String(p.designation).toLowerCase().includes(q)) ||
          (p.marque && String(p.marque).toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (q) {
          const aExact =
            String(a.barcode || '').toLowerCase() === q ||
            String(a.code || '').toLowerCase() === q;
          const bExact =
            String(b.barcode || '').toLowerCase() === q ||
            String(b.code || '').toLowerCase() === q;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
        }
        return String(a.designation || '').localeCompare(
          String(b.designation || ''),
          'fr'
        );
      });
  }, [produits, scanQuery, stockFilter, marqueFilter]);

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = scanQuery.trim().toLowerCase();
    if (!q) return;

    const exact = produits.find(
      (p) =>
        (p.barcode && String(p.barcode).trim().toLowerCase() === q) ||
        (p.code && String(p.code).trim().toLowerCase() === q)
    );
    const match = exact || filteredProducts[0];
    if (!match) {
      setError(`Aucun produit trouvé pour « ${scanQuery.trim()} ».`);
      return;
    }
    setError(null);
    addProductToCart(match, 1);
    setScanQuery('');
  };

  const resetCart = () => {
    setCart([]);
    setRemiseType('aucune');
    setRemiseVal('0');
    setMontantRecuTouched(false);
    setMontantRecuStr('0');
    setForcerPlafond(false);
    setError(null);
    scannerRef.current?.focus();
  };

  const handleCheckout = async () => {
    if (isReadOnly) {
      setError('Mode lecture seule : encaissement interdit.');
      return;
    }
    if (cart.length === 0) {
      setError('Ajoutez au moins un article au panier avant de valider.');
      return;
    }
    if (creditAlert?.bloquant && !(userRole === 'admin' && forcerPlafond)) {
      setError(
        `Plafond de crédit dépassé (${fmtDA(creditAlert.soldeProjete)} > ${fmtDA(
          creditAlert.plafond
        )}). Encaissez davantage ou utilisez un client autorisé.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<any>('/api/bureau/bons-vente', {
        method: 'POST',
        token,
        body: JSON.stringify({
          client_id: clientId,
          date_bon: new Date().toISOString().slice(0, 10),
          montant_verse: montantVerse,
          montant_recu: montantRecu,
          mode_reglement: modeReglement,
          remise_type: remiseType,
          remise_valeur: remiseNum,
          observations: observations || 'Vente comptoir POS',
          forcer_plafond: forcerPlafond,
          pos_comptoir: true,
          lignes: cart.map((l) => ({
            produit_id: l.produit_id,
            quantite: l.quantite,
            prix_unitaire: l.prix_unitaire,
            remise: l.remise,
            niveau_prix: l.niveau_prix,
          })),
        }),
      });

      const enrichedBon = {
        ...res,
        client_nom: selectedClient?.nom || 'Client Comptoir',
      };
      setFlashMsg(
        `Vente ${res.numero} validée (${fmtDA(res.total_ttc)}${
          renduMonnaie > 0 ? ` · Rendu ${fmtDA(renduMonnaie)}` : ''
        }).${res.credit_warning ? ` ⚠️ ${res.credit_warning}` : ''}`
      );
      if (autoPrintTicket) {
        setTicketBon(enrichedBon);
      }
      resetCart();
      await loadPosData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la validation POS');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (ticketBon) return;
      if (e.key === 'F2') {
        e.preventDefault();
        scannerRef.current?.focus();
        scannerRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        recuRef.current?.focus();
        recuRef.current?.select();
      } else if (e.key === 'F9' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  });

  const orderedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      if (a.code === 'CLT-COMPTOIR') return -1;
      if (b.code === 'CLT-COMPTOIR') return 1;
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
    });
  }, [clients]);

  const totalUnitesCart = cart.reduce((acc, l) => acc + l.quantite, 0);

  return (
    <div className="no-print">
      <div className="page-header">
        <div>
          <h2 className="page-title">🖥️ Caisse Rapide (POS Comptoir)</h2>
          <p className="page-subtitle">
            Raccourcis clavier : <strong>F2</strong> Scanner / Recherche ·{' '}
            <strong>Entrée</strong> Ajouter 1er résultat ·{' '}
            <strong>F4</strong> Montant reçu · <strong>F9</strong> Valider
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-muted"
            onClick={() => onNavigate('bons_vente')}
          >
            🏷️ Historique Bons de Vente
          </button>
          <button
            type="button"
            className="btn btn-muted"
            onClick={loadPosData}
          >
            🔄 Actualiser stocks
          </button>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}
      {flashMsg && (
        <div
          className="alert-box alert-success"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{flashMsg}</span>
          <button
            type="button"
            className="btn btn-muted"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={() => setFlashMsg(null)}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ color: 'var(--muted)' }}>
          Chargement du catalogue caisse...
        </div>
      ) : (
        <div className="pos-layout">
          {/* COLONNE GAUCHE : SCANNER & CATALOGUE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 2, minWidth: 240, position: 'relative' }}>
                  <input
                    ref={scannerRef}
                    className="input"
                    style={{
                      width: '100%',
                      fontSize: 14,
                      padding: '10px 12px',
                      borderColor: 'var(--accent)',
                    }}
                    placeholder="🔫 Scanner code-barres ou saisir désignation / code puis Entrée..."
                    value={scanQuery}
                    onChange={(e) => setScanQuery(e.target.value)}
                    onKeyDown={handleScannerKeyDown}
                  />
                </div>
                <select
                  className="select"
                  value={stockFilter}
                  onChange={(e) =>
                    setStockFilter(e.target.value as 'tous' | 'dispo' | 'alerte')
                  }
                >
                  <option value="tous">Stock : Tous ({produits.length})</option>
                  <option value="dispo">Disponibles (&gt; 0)</option>
                  <option value="alerte">Stock faible / rupture</option>
                </select>
                {marques.length > 0 && (
                  <select
                    className="select"
                    value={marqueFilter}
                    onChange={(e) => setMarqueFilter(e.target.value)}
                  >
                    <option value="Toutes">Toutes marques</option>
                    {marques.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {scanQuery.trim() && filteredProducts.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  Appuyez sur <strong>Entrée</strong> pour ajouter :{' '}
                  <strong style={{ color: 'var(--text)' }}>
                    {filteredProducts[0].designation}
                  </strong>{' '}
                  ({fmtDA(resolvePriceForClient(filteredProducts[0], clientId))})
                </div>
              )}
            </div>

            <div className="pos-catalog-grid">
              {filteredProducts.length === 0 ? (
                <div className="card" style={{ gridColumn: '1 / -1', color: 'var(--muted)' }}>
                  Aucun produit correspondant à la recherche.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const pu = resolvePriceForClient(p, clientId);
                  const stockVal = Number(p.stock_actuel || 0);
                  const stockMin = Number(p.stock_min || 0);
                  const inCart = cart.find((l) => l.produit_id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`pos-prod-card ${inCart ? 'in-cart' : ''}`}
                      onClick={() => addProductToCart(p, 1)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 4,
                          width: '100%',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--muted)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {p.barcode || p.code}
                        </span>
                        <span
                          className={`badge ${
                            stockVal <= 0
                              ? 'badge-red'
                              : stockVal <= stockMin
                              ? 'badge-orange'
                              : 'badge-green'
                          }`}
                          style={{ fontSize: 10, padding: '1px 6px' }}
                        >
                          {stockVal} {p.unite}
                        </span>
                      </div>
                      <div className="pos-prod-title">{p.designation}</div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                          marginTop: 'auto',
                        }}
                      >
                        <strong style={{ color: 'var(--accent)', fontSize: 14 }}>
                          {fmtDA(pu)}
                        </strong>
                        {inCart && (
                          <span className="badge badge-blue">
                            ×{inCart.quantite}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* DERNIERS TICKETS */}
            {recentBons.length > 0 && (
              <div className="card">
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>🧾 Derniers tickets / ventes enregistrées</span>
                  <button
                    type="button"
                    className="btn btn-muted"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => onNavigate('bons_vente')}
                  >
                    Tout voir →
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {recentBons.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="btn btn-muted"
                      style={{ fontSize: 11, padding: '5px 9px' }}
                      onClick={() => setTicketBon(b)}
                      title="Réimprimer le ticket 80 mm"
                    >
                      🧾 {b.numero} · {b.client_nom} ·{' '}
                      <strong>{fmtDA(b.total)}</strong>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* COLONNE DROITE : PANIER & ENCAISSEMENT */}
          <div className="card pos-cart-panel">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <strong style={{ fontSize: 15 }}>
                🛒 Ticket en cours ({cart.length} lig. · {totalUnitesCart} u.)
              </strong>
              {cart.length > 0 && (
                <button
                  type="button"
                  className="btn btn-red"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={resetCart}
                >
                  🗑 Vider
                </button>
              )}
            </div>

            {/* Client */}
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Client</label>
              <select
                className="select"
                value={clientId}
                onChange={(e) => handleClientChange(Number(e.target.value))}
              >
                {orderedClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code === 'CLT-COMPTOIR'
                      ? `🛒 ${c.nom} (Comptoir)`
                      : `${c.nom} (${c.code}) — Solde: ${fmtDA(c.solde)}`}
                  </option>
                ))}
              </select>
            </div>

            {selectedClient &&
              selectedClient.code === 'CLT-COMPTOIR' &&
              restePayer > 0 && (
                <div
                  className="alert-box alert-warn"
                  style={{ marginBottom: 10, fontSize: 11 }}
                >
                  Client COMPTOIR : le montant reçu est inférieur au Total TTC (
                  {fmtDA(restePayer)} manquant). Saisissez le montant complet ou
                  sélectionnez un client nominatif.
                </div>
              )}

            {creditAlert && (
              <div
                className={`alert-box ${
                  creditAlert.bloquant ? 'alert-error' : 'alert-warn'
                }`}
                style={{ marginBottom: 10, fontSize: 11 }}
              >
                <div style={{ fontWeight: 700 }}>
                  {creditAlert.bloquant
                    ? '⛔ Plafond de crédit bloquant dépassé'
                    : '⚠️ Plafond de crédit dépassé'}
                </div>
                <div>
                  Solde projeté : <strong>{fmtDA(creditAlert.soldeProjete)}</strong>{' '}
                  / Plafond : <strong>{fmtDA(creditAlert.plafond)}</strong>
                </div>
                {creditAlert.bloquant && userRole === 'admin' && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 6,
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={forcerPlafond}
                      onChange={(e) => setForcerPlafond(e.target.checked)}
                    />
                    Forcer le dépassement (Admin)
                  </label>
                )}
              </div>
            )}

            {/* Lignes panier */}
            <div className="pos-cart-lines">
              {cart.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '28px 12px',
                    color: 'var(--muted)',
                    border: '1px dashed var(--border)',
                    borderRadius: 6,
                  }}
                >
                  Scannez un code-barres ou cliquez sur un produit à gauche.
                </div>
              ) : (
                cart.map((line) => {
                  const lineTotal = Math.max(
                    0,
                    Number(
                      (line.quantite * line.prix_unitaire - line.remise).toFixed(2)
                    )
                  );
                  return (
                    <div key={line.produit_id} className="pos-cart-item">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 6,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>
                            {line.designation}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                            Stock : {line.stock_actuel} {line.unite}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-muted"
                          style={{ padding: '2px 6px', fontSize: 11 }}
                          onClick={() => updateCartQty(line.produit_id, 0)}
                          title="Retirer du panier"
                        >
                          ✕
                        </button>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          marginTop: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-muted"
                            style={{ padding: '3px 9px', fontWeight: 700 }}
                            onClick={() =>
                              updateCartQty(line.produit_id, line.quantite - 1)
                            }
                          >
                            −
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            className="input"
                            style={{
                              width: 58,
                              textAlign: 'center',
                              padding: '4px 6px',
                            }}
                            value={line.quantite}
                            onChange={(e) =>
                              updateCartQty(
                                line.produit_id,
                                Number(e.target.value || 0)
                              )
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-muted"
                            style={{ padding: '3px 9px', fontWeight: 700 }}
                            onClick={() =>
                              updateCartQty(line.produit_id, line.quantite + 1)
                            }
                          >
                            +
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            className="input"
                            style={{
                              width: 78,
                              textAlign: 'right',
                              padding: '4px 6px',
                              fontSize: 12,
                            }}
                            value={line.prix_unitaire}
                            onChange={(e) =>
                              updateCartPrice(
                                line.produit_id,
                                Number(e.target.value || 0)
                              )
                            }
                            title="Prix unitaire (DA)"
                          />
                          <strong
                            style={{
                              minWidth: 74,
                              textAlign: 'right',
                              fontSize: 12,
                            }}
                          >
                            {fmtDA(lineTotal)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Remise globale */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 110px',
                gap: 8,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--border)',
              }}
            >
              <div className="form-field">
                <label>Remise globale</label>
                <select
                  className="select"
                  value={remiseType}
                  onChange={(e) =>
                    setRemiseType(
                      e.target.value as 'aucune' | 'montant' | 'pourcentage'
                    )
                  }
                >
                  <option value="aucune">Aucune remise</option>
                  <option value="montant">Montant fixe (DA)</option>
                  <option value="pourcentage">Pourcentage (%)</option>
                </select>
              </div>
              <div className="form-field">
                <label>Valeur</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="input"
                  disabled={remiseType === 'aucune'}
                  value={remiseVal}
                  onChange={(e) => setRemiseVal(e.target.value)}
                />
              </div>
            </div>

            {/* Récapitulatif Total */}
            <div className="pos-total-box">
              {remiseMontant > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: 'var(--muted)',
                    marginBottom: 4,
                  }}
                >
                  <span>Brut : {fmtDA(brutTTC)}</span>
                  <span>Remise : −{fmtDA(remiseMontant)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13 }}>TOTAL À PAYER</span>
                <strong style={{ fontSize: 22, color: 'var(--accent)' }}>
                  {fmtDA(totalTTC)}
                </strong>
              </div>
            </div>

            {/* Encaissement & Rendu monnaie */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 10,
              }}
            >
              <div className="form-field">
                <label>Mode de règlement</label>
                <select
                  className="select"
                  value={modeReglement}
                  onChange={(e) => setModeReglement(e.target.value)}
                >
                  <option value="Espèces">💵 Espèces</option>
                  <option value="Carte / TPE">💳 Carte / TPE</option>
                  <option value="Chèque">📄 Chèque</option>
                  <option value="Virement">🏦 Virement</option>
                </select>
              </div>
              <div className="form-field">
                <label>Montant reçu (DA) [F4]</label>
                <input
                  ref={recuRef}
                  type="number"
                  step="any"
                  min="0"
                  className="input"
                  style={{ fontWeight: 700, fontSize: 14 }}
                  value={montantRecuStr}
                  onChange={(e) => {
                    setMontantRecuTouched(true);
                    setMontantRecuStr(e.target.value);
                  }}
                />
              </div>
            </div>

            {/* Coupures rapides */}
            <div
              style={{
                display: 'flex',
                gap: 5,
                flexWrap: 'wrap',
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="btn btn-muted"
                style={{ padding: '4px 8px', fontSize: 11 }}
                onClick={() => {
                  setMontantRecuTouched(false);
                  setMontantRecuStr(String(totalTTC));
                }}
              >
                Exact
              </button>
              {[500, 1000, 2000, 5000, 10000].map((billet) => (
                <button
                  key={billet}
                  type="button"
                  className="btn btn-muted"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => {
                    setMontantRecuTouched(true);
                    setMontantRecuStr(String(billet));
                  }}
                >
                  {billet.toLocaleString('fr-FR')}
                </button>
              ))}
              {selectedClient?.code !== 'CLT-COMPTOIR' && (
                <button
                  type="button"
                  className="btn btn-muted"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => {
                    setMontantRecuTouched(true);
                    setMontantRecuStr('0');
                  }}
                >
                  0 (Crédit)
                </button>
              )}
            </div>

            {/* Affichage Rendu Monnaie / Reste */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 10,
              }}
            >
              <div
                style={{
                  background:
                    renduMonnaie > 0
                      ? 'rgba(34, 197, 94, 0.14)'
                      : 'var(--input)',
                  border: `1px solid ${
                    renduMonnaie > 0 ? 'var(--green)' : 'var(--border)'
                  }`,
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Rendu monnaie
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: renduMonnaie > 0 ? 'var(--green)' : 'var(--text)',
                  }}
                >
                  {fmtDA(renduMonnaie)}
                </div>
              </div>
              <div
                style={{
                  background:
                    restePayer > 0
                      ? 'rgba(249, 115, 22, 0.14)'
                      : 'var(--input)',
                  border: `1px solid ${
                    restePayer > 0 ? 'var(--orange)' : 'var(--border)'
                  }`,
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Reste à payer
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: restePayer > 0 ? 'var(--orange)' : 'var(--text)',
                  }}
                >
                  {fmtDA(restePayer)}
                </div>
              </div>
            </div>

            <div className="form-field" style={{ marginTop: 8 }}>
              <label>Note ticket (optionnel)</label>
              <input
                className="input"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ex: Vente comptoir"
              />
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                marginTop: 10,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={autoPrintTicket}
                onChange={(e) => setAutoPrintTicket(e.target.checked)}
              />
              Ouvrir le ticket 80 mm automatiquement après validation
            </label>

            <button
              type="button"
              className="btn btn-green"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 800,
                marginTop: 12,
              }}
              disabled={isReadOnly || submitting || cart.length === 0}
              onClick={handleCheckout}
            >
              {submitting
                ? 'Validation en cours...'
                : `✅ Valider & Encaisser (${fmtDA(totalTTC)})`}
            </button>
          </div>
        </div>
      )}

      {ticketBon && (
        <Ticket80mmModal
          bon={ticketBon}
          profil={activeProfil}
          onClose={() => {
            setTicketBon(null);
            scannerRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
