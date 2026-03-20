import { createClient } from '@supabase/supabase-js';

// Using the credentials provided by the user
const supabaseUrl = 'https://whpubceytfgdfohjydmp.supabase.co';
const supabaseKey = 'sb_publishable_sWuHrgBXE6iiU_CWWt3OmQ_Mb0dvaIK';

export const supabase = createClient(supabaseUrl, supabaseKey);
