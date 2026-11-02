import { supabase } from '../../supabase';

export const OWNER_EMAIL = 'memixveloz@gmail.com';

export function isOwnerUser(
  user?: { email?: string | null; id?: string | null } | null,
  perfil?: { es_admin?: boolean | null } | null
): boolean {
  if (!user) return false;
  if (perfil?.es_admin === true) return true;
  if (user.email && user.email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    return true;
  }
  return false;
}

export async function checkIsOwner(): Promise<{
  isOwner: boolean;
  userId: string | null;
  email: string | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { isOwner: false, userId: null, email: null };

    if (user.email?.trim().toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      return { isOwner: true, userId: user.id, email: user.email ?? null };
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('es_admin')
      .eq('id', user.id)
      .maybeSingle();

    return {
      isOwner: isOwnerUser(user, perfil),
      userId: user.id,
      email: user.email ?? null,
    };
  } catch {
    return { isOwner: false, userId: null, email: null };
  }
}
