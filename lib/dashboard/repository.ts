/**
 * DashboardRepository — acesso único aos dados do dashboard.
 * Não executa consultas por card: carrega um snapshot e deriva tudo em memória.
 */

import type {
  DashboardDataSnapshot,
  DashboardPartner,
  DashboardReceivable,
  DashboardSettings,
  DashboardVehicle,
} from "./types";

export type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Repositório do Dashboard.
 * Preferir `fromSnapshot` quando o app já tiver os dados em memória (evita N+1).
 */
export class DashboardRepository {
  /**
   * Usa o estado já carregado pelo app (vehicles/partners/receivables/settings).
   * Zero consultas SQL adicionais.
   */
  fromSnapshot(input: {
    vehicles?: DashboardVehicle[] | null;
    partners?: DashboardPartner[] | null;
    receivables?: DashboardReceivable[] | null;
    settings?: DashboardSettings | null;
    asOfYmd?: string;
  }): DashboardDataSnapshot {
    return {
      vehicles: asArray<DashboardVehicle>(input.vehicles),
      partners: asArray<DashboardPartner>(input.partners),
      receivables: asArray<DashboardReceivable>(input.receivables),
      settings: input.settings && typeof input.settings === "object" ? input.settings : {},
      asOfYmd: input.asOfYmd,
    };
  }

  /**
   * Uma única rodada de leituras (3 tabelas + settings) em paralelo.
   * Usar apenas quando o snapshot em memória não estiver disponível.
   */
  async loadOnce(
    client: SupabaseLikeClient,
    userId: string,
    asOfYmd?: string
  ): Promise<DashboardDataSnapshot> {
    const [vehiclesRes, partnersRes, receivablesRes, settingsRes] = await Promise.all([
      client.from("vehicles").select("*").eq("user_id", userId),
      client.from("partners").select("id,nome,tipo").eq("user_id", userId),
      client.from("receivables").select("id,vehicle_id,valor,status").eq("user_id", userId),
      client.from("settings").select("capacidade_patio").eq("user_id", userId),
    ]);

    const firstError =
      vehiclesRes.error || partnersRes.error || receivablesRes.error || settingsRes.error;
    if (firstError) {
      throw new Error(`DashboardRepository.loadOnce: ${firstError.message}`);
    }

    const settingsRow = asArray<DashboardSettings>(settingsRes.data)[0] || {};

    return this.fromSnapshot({
      vehicles: asArray<DashboardVehicle>(vehiclesRes.data),
      partners: asArray<DashboardPartner>(partnersRes.data),
      receivables: asArray<DashboardReceivable>(receivablesRes.data),
      settings: settingsRow,
      asOfYmd,
    });
  }
}
