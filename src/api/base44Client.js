import { supabase } from './supabaseClient';

const createEntityAdapter = (tableName) => {
  return {
    list: async (orderBy = '') => {
      let query = supabase.from(tableName).select('*');
      if (orderBy) {
        const isDescending = orderBy.startsWith('-');
        const column = isDescending ? orderBy.substring(1) : orderBy;
        query = query.order(column, { ascending: !isDescending });
      }
      const { data, error } = await query;
      if (error) {
        console.error(`Error listing ${tableName}:`, error);
        throw error;
      }
      return data;
    },
    create: async (payload) => {
      // Remove id if it's undefined or null so Postgres can generate it
      if (payload && payload.id === undefined) {
        delete payload.id;
      }
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error(`Error creating ${tableName}:`, error);
        throw error;
      }
      return data;
    },
    bulkCreate: async (records) => {
      const formattedRecords = records.map(r => {
        if (r && r.id === undefined) {
          const { id, ...rest } = r;
          return rest;
        }
        return r;
      });
      const { data, error } = await supabase
        .from(tableName)
        .insert(formattedRecords)
        .select();
      if (error) {
        console.error(`Error bulkCreating ${tableName}:`, error);
        throw error;
      }
      return data;
    },
    update: async (id, payload) => {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.error(`Error updating ${tableName}:`, error);
        throw error;
      }
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) {
        console.error(`Error deleting ${tableName}:`, error);
        throw error;
      }
      return true;
    }
  };
};

export const base44 = {
  entities: {
    User: createEntityAdapter('User'),
    RawMaterial: createEntityAdapter('RawMaterial'),
    PackagingCost: createEntityAdapter('PackagingCost'),
    Product: createEntityAdapter('Product'),
    ProductFormula: createEntityAdapter('ProductFormula'),
    ManualCost: createEntityAdapter('ManualCost'),
    Calculation: createEntityAdapter('Calculation'),
    ProductionOrder: createEntityAdapter('ProductionOrder'),
    GoogleSheetsConfig: createEntityAdapter('GoogleSheetsConfig')
  },
  functions: {
    invoke: async (functionName, args) => {
      console.log(`Invoking function ${functionName} with args:`, args);
      // Under the hood, this will invoke Supabase Edge Functions
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: args
      });
      if (error) {
        console.error(`Failed to invoke function ${functionName}:`, error);
        throw error;
      }
      return data;
    }
  }
};
