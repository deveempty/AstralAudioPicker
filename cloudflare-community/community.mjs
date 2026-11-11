// Installed into the existing Audio Worker by install-community.ps1.
const games = ['Warzone', 'Black Ops 7', 'Counter-Strike 2', 'Valorant', 'Other'];
const focuses = ['focus', 'balanced', 'immersive'];
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const fail = (code, status) => json({ code }, status);
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
export const validPayload = p => !!p && p.schema === 'astral-community-cosmic' && p.version === 1 && p.stateVersion === 3 && Array.isArray(p.values) && p.values.length === 50 && p.values.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1);
async function readBody(request) {
  if (!request.headers.get('content-type')?.includes('application/json') || !request.body) throw Error('INVALID');
  const reader = request.body.getReader(); let size = 0; const chunks = [];
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 16384) throw Error('INVALID'); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw Error('INVALID'); }
}
async function limit(db, user, action, max) {
  const hour = Math.floor(Date.now() / 3600000);
  const row = await db.prepare(`INSERT INTO community_limits(user_id,action,hour,count) VALUES(?,?,?,1)
    ON CONFLICT(user_id,action) DO UPDATE SET hour=excluded.hour,
    count=CASE WHEN community_limits.hour=excluded.hour THEN community_limits.count+1 ELSE 1 END RETURNING count`).bind(user, action, hour).first();
  return row.count <= max;
}
const profile = (row, user) => ({ id: row.id, name: row.name, author: row.author, game: row.game, headphones: row.headphones, focus: row.focus, notes: row.notes, version: row.version, createdAt: row.created_at, saved: !!row.saved, owned: row.owner === user, applications: row.applications });

export async function communityRequest(request, env) {
  try {
    if (!env.COMMUNITY_DB || !env.AUDIO_BUCKET || !env.ASTRAL_BOT) return fail('COMMUNITY_UNAVAILABLE', 503);
    const url = new URL(request.url), parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'community' || parts[1] !== 'profiles' || parts.length > 4 || (parts[2] && !uuid(parts[2]))) return fail('NOT_FOUND', 404);
    const id = parts[2], action = parts[3], method = request.method;
    const allowed = !id ? ['GET','POST'] : !action ? ['GET','DELETE'] : action === 'favorite' ? ['PUT','DELETE'] : ['report','applied'].includes(action) ? ['POST'] : [];
    if (!allowed.includes(method)) return fail('INVALID_REQUEST', 405);
    // Identity is exclusively the service's verified Discord identity, never a body field.
    const headers = new Headers();
    for (const name of ['Authorization','X-Audio-HWID','X-Audio-Key','X-Audio-Time','X-Audio-Nonce','X-Audio-Signature']) { const v=request.headers.get(name); if (v) headers.set(name,v); }
    const auth = await env.ASTRAL_BOT.fetch('https://internal/audio/authorize', { method:'POST', headers });
    if (!auth.ok) return new Response(auth.body, { status:auth.status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'} });
    const identity = await auth.json();
    if (!/^\d{17,20}$/.test(identity.id) || !text(identity.username,80)) return fail('AUTH_UNAVAILABLE',503);
    const user = identity.id, db = env.COMMUNITY_DB;
    if (!await limit(db,user,method === 'GET' ? 'read' : 'write',method === 'GET' ? 1200 : 120)) return fail('RATE_LIMITED',429);
    if (!id && method === 'GET') {
      const tab=url.searchParams.get('tab') || 'explore', search=(url.searchParams.get('search')||'').trim(), game=url.searchParams.get('game')||'', page=Number(url.searchParams.get('page')||0);
      if (!['explore','saved','mine'].includes(tab) || search.length>100 || (game && !games.includes(game)) || !Number.isSafeInteger(page) || page<0 || page>1000) return fail('INVALID',400);
      const clauses=["p.status='published'"], args=[user];
      if(tab==='mine'){clauses.push('p.owner=?');args.push(user);}
      if(tab==='saved')clauses.push('f.user_id IS NOT NULL');
      if(game){clauses.push('p.game=?');args.push(game);}
      if(search){clauses.push("instr(lower(p.name || ' ' || p.author || ' ' || p.headphones),lower(?))>0");args.push(search);}
      const rows=await db.prepare(`SELECT p.*,f.user_id AS saved,(SELECT count(*) FROM community_applications a WHERE a.profile_id=p.id) AS applications FROM community_profiles p LEFT JOIN community_favorites f ON f.profile_id=p.id AND f.user_id=? WHERE ${clauses.join(' AND ')} ORDER BY applications DESC,p.created_at DESC,p.id DESC LIMIT 25 OFFSET ?`).bind(...args,page*24).all();
      return json({profiles:rows.results.slice(0,24).map(r=>profile(r,user)),more:rows.results.length>24});
    }
    if (!id && method === 'POST') {
      const body=await readBody(request);
      if (!uuid(body?.requestId) || !text(body.name,60) || !(body.notes===undefined || body.notes==='' || text(body.notes,600)) || !text(body.headphones,80) || !games.includes(body.game) || !focuses.includes(body.focus) || !validPayload(body.payload)) return fail('INVALID',400);
      const metadata={name:body.name.trim(),notes:body.notes?.trim() || '',headphones:body.headphones.trim(),game:body.game,focus:body.focus};
      const payload=JSON.stringify({schema:'astral-community-cosmic',version:1,stateVersion:3,values:body.payload.values});
      const digest=await hash(payload), requestHash=await hash(JSON.stringify(metadata)+payload);
      const existing=await db.prepare('SELECT * FROM community_profiles WHERE id=?').bind(body.requestId).first();
      if(existing)return existing.owner===user && existing.request_hash===requestHash && existing.status==='published' ? json({id:existing.id}) : fail('CONFLICT',409);
      const owned=await db.prepare("SELECT count(*) AS count FROM community_profiles WHERE owner=? AND status='published'").bind(user).first();
      if(owned.count>=5)return fail('PROFILE_LIMIT_REACHED',409);
      if(!await limit(db,user,'publish',20))return fail('RATE_LIMITED',429);
      // Keys include the authenticated owner and content hash: concurrent retries cannot overwrite another payload.
      const key=`community-private/${user}/${body.requestId}/${digest}.json`;
      await env.AUDIO_BUCKET.put(key,payload,{httpMetadata:{contentType:'application/json'}});
      await db.prepare(`INSERT INTO community_profiles(id,owner,author,name,game,headphones,focus,notes,object_key,sha256,request_hash,created_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM community_profiles WHERE owner=? AND status='published')<5
        ON CONFLICT(id) DO NOTHING`).bind(body.requestId,user,identity.username,metadata.name,metadata.game,metadata.headphones,metadata.focus,metadata.notes,key,digest,requestHash,new Date().toISOString(),user).run();
      const committed=await db.prepare('SELECT * FROM community_profiles WHERE id=?').bind(body.requestId).first();
      if(!committed)return fail('PROFILE_LIMIT_REACHED',409);
      if(committed.owner!==user || committed.request_hash!==requestHash)return fail('CONFLICT',409);
      return json({id:body.requestId},201);
    }
    const row=await db.prepare("SELECT * FROM community_profiles WHERE id=? AND status='published'").bind(id).first();
    if(!row)return fail('NOT_FOUND',404);
    if(!action && method==='GET') {
      const object=await env.AUDIO_BUCKET.get(row.object_key);
      if(!object || object.size>16384)return fail('PROFILE_UNAVAILABLE',503);
      const raw=await object.text();
      if(await hash(raw)!==row.sha256)return fail('INVALID_PROFILE',503);
      const payload=JSON.parse(raw);if(!validPayload(payload))return fail('INVALID_PROFILE',503);
      return json({id:row.id,version:row.version,payload,sha256:row.sha256});
    }
    if(!action && method==='DELETE') {
      if(row.owner!==user)return fail('FORBIDDEN',403);
      // Soft removal allows moderation/recovery without breaking previous users' active settings.
      await db.prepare("UPDATE community_profiles SET status='removed' WHERE id=? AND owner=?").bind(id,user).run();
      return json({removed:true});
    }
    if(action==='applied') {
      const body=await readBody(request);if(!uuid(body?.requestId))return fail('INVALID',400);
      await db.prepare('INSERT OR IGNORE INTO community_applications(user_id,request_id,profile_id) VALUES(?,?,?)').bind(user,body.requestId,id).run();
      const receipt=await db.prepare('SELECT profile_id FROM community_applications WHERE user_id=? AND request_id=?').bind(user,body.requestId).first();
      if(receipt.profile_id!==id)return fail('CONFLICT',409);
      const count=await db.prepare('SELECT count(*) AS applications FROM community_applications WHERE profile_id=?').bind(id).first();
      return json(count);
    }
    if(action==='favorite') {
      if(method==='PUT')await db.prepare('INSERT OR IGNORE INTO community_favorites(user_id,profile_id) VALUES(?,?)').bind(user,id).run();
      else await db.prepare('DELETE FROM community_favorites WHERE user_id=? AND profile_id=?').bind(user,id).run();
      return json({saved:method==='PUT'});
    }
    const body=await readBody(request);if(!text(body?.reason,600))return fail('INVALID',400);
    await db.prepare('INSERT INTO community_reports(user_id,profile_id,reason,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id,profile_id) DO UPDATE SET reason=excluded.reason,created_at=excluded.created_at').bind(user,id,body.reason.trim(),new Date().toISOString()).run();
    return json({reported:true});
  } catch (error) { return fail(error?.message==='INVALID'?'INVALID':'COMMUNITY_UNAVAILABLE',error?.message==='INVALID'?400:503); }
}
