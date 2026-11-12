import { useState, useEffect, useCallback } from 'react';
import { Loader2, Crown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { displayNameOf } from '@/lib/types';
import type { Server, Profile, Role, MemberRole } from '@/lib/types';
import UserAvatar from '@/components/ui/UserAvatar';

interface MemberListProps {
  server: Server;
}

interface MemberWithRole {
  profile: Profile;
  role: Role | null;
  isOwner: boolean;
}

export default function MemberList({ server }: MemberListProps) {
  const [members, setMembers] = useState<MemberWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    setLoading(true);

    const { data: rolesData } = await supabase
      .from('roles')
      .select('*')
      .eq('server_id', server.id);
    const roles = (rolesData ?? []) as Role[];
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    const { data: memberRolesData } = await supabase
      .from('member_roles')
      .select('*')
      .eq('server_id', server.id);
    const memberRoles = (memberRolesData ?? []) as MemberRole[];

    const userRoleMap = new Map<string, Role | null>();
    for (const mr of memberRoles) {
      const role = roleMap.get(mr.role_id);
      if (!role) continue;
      const current = userRoleMap.get(mr.user_id);
      if (!current || role.position > current.position) {
        userRoleMap.set(mr.user_id, role);
      }
    }

    const { data: memberships } = await supabase
      .from('server_members')
      .select('user_id')
      .eq('server_id', server.id);
    const memberIds = [...new Set([
      ...(memberships ?? []).map((m) => m.user_id),
      server.owner_id,
    ])];

    if (memberIds.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', memberIds);
    const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p as Profile]));

    const memberList: MemberWithRole[] = memberIds.map((uid) => {
      const profile = profileMap.get(uid);
      if (!profile) return null;
      return {
        profile,
        role: userRoleMap.get(uid) ?? null,
        isOwner: uid === server.owner_id,
      };
    }).filter((m): m is MemberWithRole => m !== null);

    memberList.sort((a, b) => {
      const aPos = a.role?.position ?? -1;
      const bPos = b.role?.position ?? -1;
      if (a.isOwner) return -1;
      if (b.isOwner) return 1;
      if (bPos !== aPos) return bPos - aPos;
      return displayNameOf(a.profile).localeCompare(displayNameOf(b.profile));
    });

    setMembers(memberList);
    setLoading(false);
  }, [server.id, server.owner_id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  if (loading) {
    return (
      <div className="w-60 shrink-0 bg-[#2f3136] flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#72767d] animate-spin" />
      </div>
    );
  }

  // Group members by role (or "Ohne Rolle")
  const groups: { roleName: string; color: string; members: MemberWithRole[] }[] = [];
  const groupMap = new Map<string, { roleName: string; color: string; members: MemberWithRole[] }>();

  for (const m of members) {
    const key = m.isOwner ? '__owner' : m.role?.id ?? '__none';
    const label = m.isOwner ? 'Eigentümer' : m.role?.name ?? 'Ohne Rolle';
    const color = m.isOwner ? '#faa61a' : m.role?.color ?? '#99aab5';
    if (!groupMap.has(key)) {
      const group = { roleName: label, color, members: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key)!.members.push(m);
  }

  return (
    <div className="w-60 shrink-0 bg-[#2f3136] flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[#202225] shrink-0">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Mitglieder — {members.length}</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <div key={group.roleName} className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider px-1.5 mb-1" style={{ color: group.color }}>
              {group.roleName} — {group.members.length}
            </p>
            <ul className="space-y-0.5">
              {group.members.map(({ profile, isOwner }) => (
                <li key={profile.id}>
                  <div className="flex items-center gap-2.5 px-1.5 py-1.5 rounded hover:bg-[#393c43] transition-colors group">
                    <UserAvatar
                      name={displayNameOf(profile)}
                      avatarUrl={profile.avatar_url}
                      className="w-8 h-8 text-xs shrink-0"
                    />
                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: group.color }}
                      >
                        {displayNameOf(profile)}
                      </span>
                      {isOwner && (
                        <Crown className="w-3 h-3 text-[#faa61a] shrink-0" title="Eigentümer" />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {members.length === 0 && (
          <p className="text-xs text-[#72767d] text-center py-8">Keine Mitglieder</p>
        )}
      </div>
    </div>
  );
}
