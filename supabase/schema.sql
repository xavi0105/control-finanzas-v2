-- ============================================================
-- CONTROL DE FINANZAS - Esquema para Supabase
-- Ejecutar este script en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Tabla de cuentas
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'efectivo',
  description text,
  initial_balance numeric(14,2) not null default 0,
  credit_limit numeric(14,2),
  cut_day integer,
  pay_day integer,
  interest_rate numeric(6,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Asegurar columnas nuevas en tablas existentes (si ya corriste una versión anterior)
alter table public.accounts add column if not exists initial_balance numeric(14,2) not null default 0;
alter table public.accounts add column if not exists credit_limit numeric(14,2);
alter table public.accounts add column if not exists cut_day integer;
alter table public.accounts add column if not exists pay_day integer;
alter table public.accounts add column if not exists interest_rate numeric(6,2) not null default 0;

-- Tabla de categorías (ingresos y gastos)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text default '#0ea5e9',
  created_at timestamptz not null default now()
);

-- Tabla de transacciones
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_date on public.transactions(user_id, date desc);
create index if not exists idx_transactions_account on public.transactions(account_id);
create index if not exists idx_transactions_category on public.transactions(category_id);

-- Tabla de metas de ahorro
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  saved_amount numeric(14,2) not null default 0 check (saved_amount >= 0),
  deadline date,
  created_at timestamptz not null default now()
);

-- Tabla de presupuestos mensuales por categoría
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

-- ============================================================
-- ROW LEVEL SECURITY: cada usuario solo ve/edita sus datos
-- ============================================================
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.budgets enable row level security;

create policy "accounts_select" on public.accounts
  for select using (auth.uid() = user_id);
create policy "accounts_insert" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts_update" on public.accounts
  for update using (auth.uid() = user_id);
create policy "accounts_delete" on public.accounts
  for delete using (auth.uid() = user_id);

create policy "categories_select" on public.categories
  for select using (auth.uid() = user_id);
create policy "categories_insert" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update" on public.categories
  for update using (auth.uid() = user_id);
create policy "categories_delete" on public.categories
  for delete using (auth.uid() = user_id);

create policy "transactions_select" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_update" on public.transactions
  for update using (auth.uid() = user_id);
create policy "transactions_delete" on public.transactions
  for delete using (auth.uid() = user_id);

create policy "goals_select" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals_insert" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals_update" on public.goals
  for update using (auth.uid() = user_id);
create policy "goals_delete" on public.goals
  for delete using (auth.uid() = user_id);

create policy "budgets_select" on public.budgets
  for select using (auth.uid() = user_id);
create policy "budgets_insert" on public.budgets
  for insert with check (auth.uid() = user_id);
create policy "budgets_update" on public.budgets
  for update using (auth.uid() = user_id);
create policy "budgets_delete" on public.budgets
  for delete using (auth.uid() = user_id);

-- ============================================================
-- CATEGORÍAS POR DEFECTO (se crean al registrar usuario)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.accounts (user_id, name, type, description)
  values (new.id, 'Efectivo', 'efectivo', 'Cuenta principal de efectivo');

  insert into public.categories (user_id, name, type, color) values
    (new.id, 'Salario', 'income', '#10b981'),
    (new.id, 'Ventas', 'income', '#14b8a6'),
    (new.id, 'Inversiones', 'income', '#3b82f6'),
    (new.id, 'Otros ingresos', 'income', '#8b5cf6'),
    (new.id, 'Alimentación', 'expense', '#f59e0b'),
    (new.id, 'Transporte', 'expense', '#0ea5e9'),
    (new.id, 'Vivienda', 'expense', '#ef4444'),
    (new.id, 'Servicios', 'expense', '#6366f1'),
    (new.id, 'Salud', 'expense', '#ec4899'),
    (new.id, 'Entretenimiento', 'expense', '#f97316'),
    (new.id, 'Educación', 'expense', '#22c55e'),
    (new.id, 'Otros gastos', 'expense', '#94a3b8');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();