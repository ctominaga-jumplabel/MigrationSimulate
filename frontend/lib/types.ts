// Tipos do domínio — derivados do contrato da API (api/main.py).
// NÃO contêm lógica de cálculo; só a forma dos dados que a API devolve.

export type Cenario = "bruto" | "sem_dup";

export interface Params {
  n_consultores: number;
  n_colaboradores: number; // colaboradores do cliente (migração manual)
  horas_dia: number;
  J_base: number;
  J_task: number;
  K: number;
  data_inicio: string; // ISO yyyy-mm-dd
  cenario: Cenario;
  prioridades?: PrioridadeItem[];
}

export interface PrioridadeItem {
  tipo: "egp" | "orfao";
  nome: string;
  prioridade: number;
}

export interface ScenarioKpis {
  horas_sas: number;
  horas_job: number;
  esforco_base: number;
  K: number;
  esforco_total: number;
  duracao_horas: number;
  duracao_dias_uteis: number;
  n_sprints: number;
  n_egps: number;
  n_orfaos: number;
}

export interface ScenariosResponse {
  bruto: ScenarioKpis;
  sem_dup: ScenarioKpis;
}

export interface OverviewBlock {
  horas_totais: number;
  n_egps: number;
  n_orfaos: number;
  n_sas: number;
  n_pipeline_family: number;
}

export interface CategoriaRow {
  categoria: string;
  n_sas: number;
  soma_horas: number;
}

export interface CatalogResponse {
  overview: { bruto: OverviewBlock; sem_dup_arquivo: OverviewBlock };
  categoria_distribution: CategoriaRow[];
  categoria_order: string[];
  migrate_gain_default: Record<string, number>;
}

// --- Migrate (MigrateMind): tempo de desenvolvimento COM a ferramenta. ------
// Ganho por categoria = % de redução do esforço de CONVERSÃO .sas (não do Job).

// KPIs de esforço sem a fila de itens (subconjunto de ScenarioKpis).
export interface EffortKpis {
  horas_sas: number;
  horas_job: number;
  esforco_base: number;
  K: number;
  esforco_total: number;
  duracao_horas: number;
  duracao_dias_uteis: number;
  n_sprints: number;
}

export interface MigrateCategoriaRow {
  categoria: string;
  n_sas: number;
  ganho_pct: number;
  horas_manual: number;
  horas_migrate: number;
  economia_horas: number;
}

export interface MigrateScenario {
  manual: EffortKpis;
  migrate: EffortKpis;
  economia_horas: number; // esforço total manual − migrate (×K)
  ganho_pct: number; // economia / esforço manual × 100
  n_egps: number;
  n_orfaos: number;
  por_categoria: MigrateCategoriaRow[];
}

export interface MigrateResponse {
  bruto: MigrateScenario;
  sem_dup: MigrateScenario;
}

// --- Comparativo por complexidade: cliente (manual) × consultores (Migrate). --
// Duração do MESMO esforço (horas-homem, fixo) sob equipes de tamanhos diferentes.

export interface DuracaoBreakdown {
  esforco_total: number; // horas-homem (independe do tamanho da equipe)
  n_pessoas: number;
  duracao_horas: number; // duração de calendário em horas úteis
  duracao_dias: number; // dias úteis
  duracao_meses: number; // meses (21 dias úteis/mês)
  duracao_anos: number; // anos (252 dias úteis/ano)
}

export interface ComplexidadeRow {
  categoria: string;
  n_egp: number; // processos (.egp) com esta categoria predominante
  horas_egp: number; // esforço MANUAL dos .egp (conversão + Job), ×K
  horas_egp_migrate: number; // esforço dos .egp COM Migrate, ×K
  n_orfao: number; // .sas ÓRFÃOS (fora de qualquer .egp) desta categoria
  horas_orfao: number; // esforço MANUAL dos .sas órfãos (conversão), ×K
  horas_orfao_migrate: number; // esforço dos .sas órfãos COM Migrate, ×K
}

export interface ComparisonScenario {
  manual: DuracaoBreakdown; // cliente, n_colaboradores pessoas
  migrate: DuracaoBreakdown; // consultores, n_consultores pessoas, com Migrate
  economia_horas: number; // esforço manual − migrate (horas-homem)
  ganho_pct: number; // economia / esforço manual × 100
  n_colaboradores: number;
  n_consultores: number;
  n_egps: number;
  n_orfaos: number;
  complexidade: ComplexidadeRow[];
}

export interface ComparisonResponse {
  bruto: ComparisonScenario;
  sem_dup: ComparisonScenario;
}

export interface EgpRow {
  egp_name: string;
  n_sas: number;
  horas_sas: number;
  horas_job: number;
  horas_total: number;
  categoria_predominante: string;
  // Esforço COM Migrate por EGP (conversão por categoria + Job ponderado).
  horas_sas_migrate: number;
  horas_job_migrate: number;
  horas_total_migrate: number;
}

export interface EgpsResponse {
  cenario: Cenario;
  egps: EgpRow[];
}

export interface SasChild {
  file_name: string;
  categoria: string;
  horas_estimadas: number;
  is_likely_duplicate: boolean;
}

export interface OrphanRow {
  file_name: string;
  categoria: string;
  horas_estimadas: number;
}

export interface OrphansResponse {
  cenario: Cenario;
  orphans: OrphanRow[];
}

export interface SprintRow {
  sprint: number;
  data_inicio: string;
  data_fim: string;
  horas_alocadas: number;
  capacidade: number;
  itens_no_sprint: number;
}

export interface AlocacaoRow {
  prioridade: number;
  tipo: "egp" | "orfao";
  nome: string;
  horas: number;
  sprint_inicial: number;
  sprint_final: number;
}

export interface SprintsResponse {
  cenario: Cenario;
  kpis: ScenarioKpis;
  resumo_sprints: SprintRow[];
  alocacao: AlocacaoRow[];
}
