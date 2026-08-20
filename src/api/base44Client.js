import { supabase } from '@/api/supabaseClient';

const getUserProfile = async (authUser) => {
  if (!authUser) return null;

  const { data: profileById, error: idError } = await supabase
    .from('User')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (idError) throw idError;
  if (profileById) return profileById;

  if (!authUser.email) return null;

  const { data: profileByEmail, error: emailError } = await supabase
    .from('User')
    .select('*')
    .eq('email', authUser.email)
    .maybeSingle();

  if (emailError) throw emailError;
  return profileByEmail;
};

const createEntityAdapter = (tableName) => {
  return {
    list: async (orderBy = '', limit) => {
      let query = supabase.from(tableName).select('*');
      if (orderBy) {
        const isDescending = orderBy.startsWith('-');
        const column = isDescending ? orderBy.substring(1) : orderBy;
        query = query.order(column, { ascending: !isDescending });
      }
      if (Number.isFinite(limit)) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (error) {
        console.error(`Error listing ${tableName}:`, error);
        throw error;
      }
      return data || [];
    },
    create: async (payload) => {
      const record = { ...(payload || {}) };
      if (record.id == null) delete record.id;
      const { data, error } = await supabase
        .from(tableName)
        .insert(record)
        .select()
        .single();
      if (error) {
        console.error(`Error creating ${tableName}:`, error);
        throw error;
      }
      return data;
    },
    bulkCreate: async (records) => {
      const formattedRecords = records.map((record) => {
        if (record?.id == null) {
          const { id: _id, ...rest } = record;
          return rest;
        }
        return record;
      });
      const { data, error } = await supabase
        .from(tableName)
        .insert(formattedRecords)
        .select();
      if (error) {
        console.error(`Error bulkCreating ${tableName}:`, error);
        throw error;
      }
      return data || [];
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
    },
  };
};

const auth = {
  me: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    if (!user) return null;

    const profile = await getUserProfile(user);
    return profile ? { ...user, ...profile } : user;
  },
  register: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },
  verifyOtp: async ({ email, otpCode }) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'signup',
    });
    if (error) throw error;
    return data.session || data;
  },
  setToken: () => undefined,
  resendOtp: async (email) => {
    const { data, error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
    return data;
  },
  loginWithProvider: async (provider, redirectPath = '/') => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}${redirectPath}`,
      },
    });
    if (error) throw error;
    return data;
  },
  resetPasswordRequest: async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return data;
  },
  resetPassword: async ({ newPassword }) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },
};

export const base44 = {
  auth,
  entities: {
    User: createEntityAdapter('User'),
    RawMaterial: createEntityAdapter('RawMaterial'),
    PackagingCost: createEntityAdapter('PackagingCost'),
    Product: createEntityAdapter('Product'),
    ProductFormula: createEntityAdapter('ProductFormula'),
    ManualCost: createEntityAdapter('ManualCost'),
    Calculation: createEntityAdapter('Calculation'),
    ProductionOrder: createEntityAdapter('ProductionOrder'),
    GoogleSheetsConfig: createEntityAdapter('GoogleSheetsConfig'),
  },
  functions: {
    invoke: async (functionName, args = {}) => {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: args,
      });
      if (error) {
        console.error(`Failed to invoke function ${functionName}:`, error);
        throw error;
      }
      return data;
    },
  },
};
