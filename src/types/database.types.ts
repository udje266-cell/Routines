
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "category_caps": {
                  Row: {
                    "cap": number,"category": string,"id": string,"pleasure": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cap": number,"category": string,"id"?: string,"pleasure"?: boolean,"user_id"?: string
                  }
                  Update: {
                    "cap"?: number,"category"?: string,"id"?: string,"pleasure"?: boolean,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"debt_payments": {
                  Row: {
                    "amount": number,"created_at": string,"debt_id": string,"id": string,"operation_id": string,"paid_on": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"debt_id": string,"id"?: string,"operation_id": string,"paid_on": string,"user_id"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"debt_id"?: string,"id"?: string,"operation_id"?: string,"paid_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "debt_payments_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "operations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "debt_payments_user_id_debt_id_fkey"
      columns: ["user_id","debt_id"]
isOneToOne: false
      referencedRelation: "debts"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"debts": {
                  Row: {
                    "certainty": Database["public"]['Enums']["certainty"] | null,"created_at": string,"direction": Database["public"]['Enums']["debt_direction"],"due_date": string | null,"id": string,"initial_amount": number,"person": string,"status": Database["public"]['Enums']["debt_status"],"user_id": string,"wallet_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "certainty"?: Database["public"]['Enums']["certainty"] | null,"created_at"?: string,"direction": Database["public"]['Enums']["debt_direction"],"due_date"?: string | null,"id"?: string,"initial_amount": number,"person": string,"status"?: Database["public"]['Enums']["debt_status"],"user_id"?: string,"wallet_id"?: string | null
                  }
                  Update: {
                    "certainty"?: Database["public"]['Enums']["certainty"] | null,"created_at"?: string,"direction"?: Database["public"]['Enums']["debt_direction"],"due_date"?: string | null,"id"?: string,"initial_amount"?: number,"person"?: string,"status"?: Database["public"]['Enums']["debt_status"],"user_id"?: string,"wallet_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "debts_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallet_balances"
      referencedColumns: ["user_id","wallet_id"]
    },{
      foreignKeyName: "debts_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "created_at": string,"from_wallet_id": string | null,"id": string,"name": string,"planned_day": number,"pocket_wallet_id": string,"status": Database["public"]['Enums']["goal_status"],"target_amount": number,"target_date": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_wallet_id"?: string | null,"id"?: string,"name": string,"planned_day"?: number,"pocket_wallet_id": string,"status"?: Database["public"]['Enums']["goal_status"],"target_amount": number,"target_date": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"from_wallet_id"?: string | null,"id"?: string,"name"?: string,"planned_day"?: number,"pocket_wallet_id"?: string,"status"?: Database["public"]['Enums']["goal_status"],"target_amount"?: number,"target_date"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goals_user_id_from_wallet_id_fkey"
      columns: ["user_id","from_wallet_id"]
isOneToOne: false
      referencedRelation: "wallet_balances"
      referencedColumns: ["user_id","wallet_id"]
    },{
      foreignKeyName: "goals_user_id_from_wallet_id_fkey"
      columns: ["user_id","from_wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "goals_user_id_pocket_wallet_id_fkey"
      columns: ["user_id","pocket_wallet_id"]
isOneToOne: false
      referencedRelation: "wallet_balances"
      referencedColumns: ["user_id","wallet_id"]
    },{
      foreignKeyName: "goals_user_id_pocket_wallet_id_fkey"
      columns: ["user_id","pocket_wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"operations": {
                  Row: {
                    "amount": number,"category": string | null,"client_key": string,"created_at": string,"debt_id": string | null,"fee": number,"goal_id": string | null,"id": string,"income_type": Database["public"]['Enums']["income_type"] | null,"kind": Database["public"]['Enums']["planned_kind"],"label": string,"op_date": string,"planned_item_id": string | null,"recurring_original": string | null,"recurring_rule_id": string | null,"to_wallet_id": string | null,"user_id": string,"wallet_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category"?: string | null,"client_key": string,"created_at"?: string,"debt_id"?: string | null,"fee"?: number,"goal_id"?: string | null,"id"?: string,"income_type"?: Database["public"]['Enums']["income_type"] | null,"kind": Database["public"]['Enums']["planned_kind"],"label"?: string,"op_date": string,"planned_item_id"?: string | null,"recurring_original"?: string | null,"recurring_rule_id"?: string | null,"to_wallet_id"?: string | null,"user_id"?: string,"wallet_id": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string | null,"client_key"?: string,"created_at"?: string,"debt_id"?: string | null,"fee"?: number,"goal_id"?: string | null,"id"?: string,"income_type"?: Database["public"]['Enums']["income_type"] | null,"kind"?: Database["public"]['Enums']["planned_kind"],"label"?: string,"op_date"?: string,"planned_item_id"?: string | null,"recurring_original"?: string | null,"recurring_rule_id"?: string | null,"to_wallet_id"?: string | null,"user_id"?: string,"wallet_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operations_user_id_debt_id_fkey"
      columns: ["user_id","debt_id"]
isOneToOne: false
      referencedRelation: "debts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "operations_user_id_goal_id_fkey"
      columns: ["user_id","goal_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "operations_user_id_planned_item_id_fkey"
      columns: ["user_id","planned_item_id"]
isOneToOne: false
      referencedRelation: "planned_items"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "operations_user_id_recurring_rule_id_fkey"
      columns: ["user_id","recurring_rule_id"]
isOneToOne: false
      referencedRelation: "recurring_rules"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "operations_user_id_to_wallet_id_fkey"
      columns: ["user_id","to_wallet_id"]
isOneToOne: false
      referencedRelation: "wallet_balances"
      referencedColumns: ["user_id","wallet_id"]
    },{
      foreignKeyName: "operations_user_id_to_wallet_id_fkey"
      columns: ["user_id","to_wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "operations_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallet_balances"
      referencedColumns: ["user_id","wallet_id"]
    },{
      foreignKeyName: "operations_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"planned_items": {
                  Row: {
                    "amount": number,"category": string | null,"certainty": Database["public"]['Enums']["certainty"] | null,"created_at": string,"due_date": string,"funded_by_income_id": string | null,"id": string,"kind": Database["public"]['Enums']["planned_kind"],"label": string,"source": string | null,"status": Database["public"]['Enums']["planned_status"],"to_wallet_id": string | null,"user_id": string,"wallet_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category"?: string | null,"certainty"?: Database["public"]['Enums']["certainty"] | null,"created_at"?: string,"due_date": string,"funded_by_income_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["planned_kind"],"label": string,"source"?: string | null,"status"?: Database["public"]['Enums']["planned_status"],"to_wallet_id"?: string | null,"user_id"?: string,"wallet_id": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string | null,"certainty"?: Database["public"]['Enums']["certainty"] | null,"created_at"?: string,"due_date"?: string,"funded_by_income_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["planned_kind"],"label"?: string,"source"?: string | null,"status"?: Database["public"]['Enums']["planned_status"],"to_wallet_id"?: string | null,"user_id"?: string,"wallet_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_items_user_id_to_wallet_id_fkey"
      columns: ["user_id","to_wallet_id"]
isOneToOne: false
      referencedRelation: "wallet_balances"
      referencedColumns: ["user_id","wallet_id"]
    },{
      foreignKeyName: "planned_items_user_id_to_wallet_id_fkey"
      columns: ["user_id","to_wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "planned_items_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallet_balances"
      referencedColumns: ["user_id","wallet_id"]
    },{
      foreignKeyName: "planned_items_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"purchase_intents": {
                  Row: {
                    "amount": number,"category": string,"client_key": string,"created_at": string,"created_on": string,"id": string,"planned_date": string,"remind_on": string | null,"status": Database["public"]['Enums']["intent_status"],"user_id": string,"wallet_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": string,"client_key": string,"created_at"?: string,"created_on"?: string,"id"?: string,"planned_date": string,"remind_on"?: string | null,"status"?: Database["public"]['Enums']["intent_status"],"user_id"?: string,"wallet_id": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"client_key"?: string,"created_at"?: string,"created_on"?: string,"id"?: string,"planned_date"?: string,"remind_on"?: string | null,"status"?: Database["public"]['Enums']["intent_status"],"user_id"?: string,"wallet_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_intents_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallet_balances"
      referencedColumns: ["user_id","wallet_id"]
    },{
      foreignKeyName: "purchase_intents_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"recurring_overrides": {
                  Row: {
                    "new_amount": number | null,"new_date": string | null,"original_date": string,"rule_id": string,"skip": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "new_amount"?: number | null,"new_date"?: string | null,"original_date": string,"rule_id": string,"skip"?: boolean,"user_id"?: string
                  }
                  Update: {
                    "new_amount"?: number | null,"new_date"?: string | null,"original_date"?: string,"rule_id"?: string,"skip"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_overrides_user_id_rule_id_fkey"
      columns: ["user_id","rule_id"]
isOneToOne: false
      referencedRelation: "recurring_rules"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"recurring_rules": {
                  Row: {
                    "amount": number,"category": string | null,"created_at": string,"day": number,"end_date": string | null,"id": string,"kind": Database["public"]['Enums']["planned_kind"],"label": string,"start_date": string,"user_id": string,"wallet_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category"?: string | null,"created_at"?: string,"day": number,"end_date"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["planned_kind"],"label": string,"start_date": string,"user_id"?: string,"wallet_id": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string | null,"created_at"?: string,"day"?: number,"end_date"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["planned_kind"],"label"?: string,"start_date"?: string,"user_id"?: string,"wallet_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_rules_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallet_balances"
      referencedColumns: ["user_id","wallet_id"]
    },{
      foreignKeyName: "recurring_rules_user_id_wallet_id_fkey"
      columns: ["user_id","wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "cycle_start_day": number,"free_next_start": string | null,"free_start": string | null,"small_threshold": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cycle_start_day"?: number,"free_next_start"?: string | null,"free_start"?: string | null,"small_threshold"?: number,"user_id"?: string
                  }
                  Update: {
                    "cycle_start_day"?: number,"free_next_start"?: string | null,"free_start"?: string | null,"small_threshold"?: number,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"wallets": {
                  Row: {
                    "created_at": string,"everyday": boolean,"id": string,"kind": Database["public"]['Enums']["wallet_kind"],"name": string,"opening_balance": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"everyday"?: boolean,"id"?: string,"kind": Database["public"]['Enums']["wallet_kind"],"name": string,"opening_balance"?: number,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"everyday"?: boolean,"id"?: string,"kind"?: Database["public"]['Enums']["wallet_kind"],"name"?: string,"opening_balance"?: number,"user_id"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            "wallet_balances": {
                  Row: {
                    "balance": number | null,"user_id": string,"wallet_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "balance"?: never,"user_id"?: string | null,"wallet_id"?: string | null
                         }
                        Update: {
                           "balance"?: never,"user_id"?: string | null,"wallet_id"?: string | null
                         }
                        Relationships: [

                  ]
                }
          }
          Functions: {
            "cancel_debt_payment":
{ Args: { "p_payment_id": string }; Returns: undefined
                           },
"delete_operation":
{ Args: { "p_id": string }; Returns: undefined
                           },
"record_debt_payment":
{ Args: { "p_amount": number,"p_client_key": string,"p_date": string,"p_debt_id": string,"p_wallet_id": string }; Returns: {
              "amount": number,
"category": string | null,
"client_key": string,
"created_at": string,
"debt_id": string | null,
"fee": number,
"goal_id": string | null,
"id": string,
"income_type": Database["public"]['Enums']["income_type"] | null,
"kind": Database["public"]['Enums']["planned_kind"],
"label": string,
"op_date": string,
"planned_item_id": string | null,
"recurring_original": string | null,
"recurring_rule_id": string | null,
"to_wallet_id": string | null,
"user_id": string,
"wallet_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "operations"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_goal_movement":
{ Args: { "p_amount": number,"p_client_key": string,"p_date": string,"p_goal_id": string,"p_wallet_id": string,"p_withdraw"?: boolean }; Returns: {
              "amount": number,
"category": string | null,
"client_key": string,
"created_at": string,
"debt_id": string | null,
"fee": number,
"goal_id": string | null,
"id": string,
"income_type": Database["public"]['Enums']["income_type"] | null,
"kind": Database["public"]['Enums']["planned_kind"],
"label": string,
"op_date": string,
"planned_item_id": string | null,
"recurring_original": string | null,
"recurring_rule_id": string | null,
"to_wallet_id": string | null,
"user_id": string,
"wallet_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "operations"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_operation":
{ Args: { "p_amount": number,"p_category"?: string,"p_client_key": string,"p_fee"?: number,"p_income_type"?: Database["public"]['Enums']["income_type"],"p_kind": Database["public"]['Enums']["planned_kind"],"p_label"?: string,"p_op_date": string,"p_planned_item_id"?: string,"p_to_wallet_id"?: string,"p_wallet_id": string }; Returns: {
              "amount": number,
"category": string | null,
"client_key": string,
"created_at": string,
"debt_id": string | null,
"fee": number,
"goal_id": string | null,
"id": string,
"income_type": Database["public"]['Enums']["income_type"] | null,
"kind": Database["public"]['Enums']["planned_kind"],
"label": string,
"op_date": string,
"planned_item_id": string | null,
"recurring_original": string | null,
"recurring_rule_id": string | null,
"to_wallet_id": string | null,
"user_id": string,
"wallet_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "operations"
        isOneToOne: true
        isSetofReturn: false
      } },
"refresh_debt_status":
{ Args: { "p_debt_id": string }; Returns: undefined
                           },
"settle_occurrence":
{ Args: { "p_amount": number,"p_client_key": string,"p_op_date": string,"p_original": string,"p_rule_id": string,"p_wallet_id": string }; Returns: {
              "amount": number,
"category": string | null,
"client_key": string,
"created_at": string,
"debt_id": string | null,
"fee": number,
"goal_id": string | null,
"id": string,
"income_type": Database["public"]['Enums']["income_type"] | null,
"kind": Database["public"]['Enums']["planned_kind"],
"label": string,
"op_date": string,
"planned_item_id": string | null,
"recurring_original": string | null,
"recurring_rule_id": string | null,
"to_wallet_id": string | null,
"user_id": string,
"wallet_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "operations"
        isOneToOne: true
        isSetofReturn: false
      } },
"split_recurring_rule":
{ Args: { "p_amount": number,"p_day": number,"p_from_original": string,"p_label": string,"p_rule_id": string,"p_wallet_id": string }; Returns: {
              "amount": number,
"category": string | null,
"created_at": string,
"day": number,
"end_date": string | null,
"id": string,
"kind": Database["public"]['Enums']["planned_kind"],
"label": string,
"start_date": string,
"user_id": string,
"wallet_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "recurring_rules"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_operation":
{ Args: { "p_amount": number,"p_category": string,"p_id": string,"p_label": string,"p_op_date": string,"p_wallet_id": string }; Returns: {
              "amount": number,
"category": string | null,
"client_key": string,
"created_at": string,
"debt_id": string | null,
"fee": number,
"goal_id": string | null,
"id": string,
"income_type": Database["public"]['Enums']["income_type"] | null,
"kind": Database["public"]['Enums']["planned_kind"],
"label": string,
"op_date": string,
"planned_item_id": string | null,
"recurring_original": string | null,
"recurring_rule_id": string | null,
"to_wallet_id": string | null,
"user_id": string,
"wallet_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "operations"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "certainty": "attendue"|"incertaine","debt_direction": "je_dois"|"on_me_doit","debt_status": "ouverte"|"reglee"|"annulee"|"remise","goal_status": "actif"|"atteint"|"abandonne","income_type": "principal"|"petite","intent_status": "en_pause"|"achete"|"abandonne"|"replanifie","planned_kind": "sortie"|"rentree"|"transfert","planned_status": "prevue"|"reglee"|"annulee","wallet_kind": "especes"|"wave"|"orange_money"|"banque"|"epargne"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "certainty": ["attendue", "incertaine"],"debt_direction": ["je_dois", "on_me_doit"],"debt_status": ["ouverte", "reglee", "annulee", "remise"],"goal_status": ["actif", "atteint", "abandonne"],"income_type": ["principal", "petite"],"intent_status": ["en_pause", "achete", "abandonne", "replanifie"],"planned_kind": ["sortie", "rentree", "transfert"],"planned_status": ["prevue", "reglee", "annulee"],"wallet_kind": ["especes", "wave", "orange_money", "banque", "epargne"]
          }
        }
} as const
