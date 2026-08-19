import { createContext, useContext, useEffect, useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const FinanceContext = createContext(null)

export function FinanceProvider({ children }) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [goals, setGoals] = useState([])
  const [budgets, setBudgets] = useState([])
  const [plannedExpenses, setPlannedExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [accRes, catRes, traRes, goalRes, budRes] = await Promise.all([
        supabase.from('accounts').select('*').order('name'),
        supabase.from('categories').select('*').order('type', { ascending: true }).order('name'),
        supabase.from('transactions').select('*').order('date', { ascending: false }).limit(1000),
        supabase.from('goals').select('*').order('created_at'),
        supabase.from('budgets').select('*')
      ])

      for (const res of [accRes, catRes, traRes, goalRes, budRes]) {
        if (res.error) throw res.error
      }

      const planRes = await supabase.from('planned_expenses').select('*').order('next_due')

      setAccounts(accRes.data)
      setCategories(catRes.data)
      setTransactions(traRes.data)
      setGoals(goalRes.data)
      setBudgets(budRes.data)
      setPlannedExpenses(planRes.error ? [] : planRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) loadAll()
    else {
      setAccounts([])
      setCategories([])
      setTransactions([])
      setGoals([])
      setBudgets([])
      setPlannedExpenses([])
      setLoading(false)
    }
  }, [user, loadAll])

  const value = {
    accounts,
    categories,
    transactions,
    goals,
    budgets,
    plannedExpenses,
    loading,
    error,
    reload: loadAll
  }

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance debe usarse dentro de FinanceProvider')
  return ctx
}