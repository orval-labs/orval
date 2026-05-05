import { describe, expect, test } from 'vitest';

import { getRoute, getRouteAsArray } from './route';

/**
 * Extended test suite for getRouteAsArray (Issue #883 fix verification)
 * ~1000+ test cases across 20 categories.
 *
 * Two helpers:
 *  - routeToArray: OpenAPI path → getRoute → getRouteAsArray (real usage flow)
 *  - directArray:  template string → getRouteAsArray (unit-level)
 */

// Helper: full pipeline (OpenAPI path → template → array string)
function routeToArray(openApiPath: string): string {
  return getRouteAsArray(getRoute(openApiPath));
}

// Helper: direct getRouteAsArray call
function directArray(templateRoute: string): string {
  return getRouteAsArray(templateRoute);
}

// ============================================================
// 1. Basic static paths (no parameters) — 40 cases
// ============================================================
describe('1. Basic static paths', () => {
  test.each([
    ['/api', "'api'"],
    ['/api/v1', "'api','v1'"],
    ['/api/v1/users', "'api','v1','users'"],
    ['/api/v1/users/list', "'api','v1','users','list'"],
    ['/health', "'health'"],
    ['/a/b/c/d/e', "'a','b','c','d','e'"],
    ['api/v1', "'api','v1'"],
    ['users', "'users'"],
    ['/api/v2/orders/items', "'api','v2','orders','items'"],
    ['/graphql', "'graphql'"],
    ['/api/v1/auth/login', "'api','v1','auth','login'"],
    ['/api/v1/auth/logout', "'api','v1','auth','logout'"],
    ['/api/v1/settings/preferences', "'api','v1','settings','preferences'"],
    ['/webhooks/incoming', "'webhooks','incoming'"],
    ['/internal/metrics', "'internal','metrics'"],
    ['/api/v3/search/results', "'api','v3','search','results'"],
    ['/static/assets/images', "'static','assets','images'"],
    ['/rpc/call', "'rpc','call'"],
    ['/feed/atom', "'feed','atom'"],
    ['/sitemap.xml', "'sitemap.xml'"],
    ['/robots.txt', "'robots.txt'"],
    ['/favicon.ico', "'favicon.ico'"],
    ['/manifest.json', "'manifest.json'"],
    ['/openapi.yaml', "'openapi.yaml'"],
    ['/swagger-ui', "'swagger-ui'"],
    ['/api-docs', "'api-docs'"],
    ['/healthz', "'healthz'"],
    ['/readyz', "'readyz'"],
    ['/livez', "'livez'"],
    ['/metrics', "'metrics'"],
    ['/status/check', "'status','check'"],
    ['/ping/pong', "'ping','pong'"],
    ['/admin/dashboard', "'admin','dashboard'"],
    ['/portal/home', "'portal','home'"],
    ['/cms/pages', "'cms','pages'"],
    ['/blog/posts', "'blog','posts'"],
    ['/shop/catalog', "'shop','catalog'"],
    ['/cdn/files', "'cdn','files'"],
    ['/ws/connect', "'ws','connect'"],
    ['/sse/events', "'sse','events'"],
  ])('static: %s → %s', (input, expected) => {
    expect(directArray(input)).toBe(expected);
  });
});

// ============================================================
// 2. Single parameter paths — 40 cases
// ============================================================
describe('2. Single parameter paths', () => {
  test.each([
    ['/users/{id}', "'users',id"],
    ['/api/{version}', "'api',version"],
    ['/orders/{orderId}', "'orders',orderId"],
    ['/{tenant}/api', "tenant,'api'"],
    ['/api/v1/{resource}', "'api','v1',resource"],
    ['/{id}', 'id'],
    ['/users/{userId}/posts', "'users',userId,'posts'"],
    ['/api/{apiVersion}/health', "'api',apiVersion,'health'"],
    ['/teams/{teamId}/members', "'teams',teamId,'members'"],
    ['/products/{productId}/reviews', "'products',productId,'reviews'"],
    ['/orgs/{orgId}/repos', "'orgs',orgId,'repos'"],
    ['/namespaces/{namespace}/pods', "'namespaces',namespace,'pods'"],
    ['/buckets/{bucketName}/objects', "'buckets',bucketName,'objects'"],
    ['/databases/{dbName}/tables', "'databases',dbName,'tables'"],
    ['/projects/{projectId}/tasks', "'projects',projectId,'tasks'"],
    ['/channels/{channelId}/messages', "'channels',channelId,'messages'"],
    ['/clusters/{clusterId}/nodes', "'clusters',clusterId,'nodes'"],
    ['/environments/{envId}/config', "'environments',envId,'config'"],
    ['/subscriptions/{subId}/invoices', "'subscriptions',subId,'invoices'"],
    ['/regions/{regionId}/zones', "'regions',regionId,'zones'"],
    ['/accounts/{accountId}/settings', "'accounts',accountId,'settings'"],
    ['/workspaces/{wsId}/boards', "'workspaces',wsId,'boards'"],
    ['/tenants/{tenantId}/users', "'tenants',tenantId,'users'"],
    ['/collections/{collId}/documents', "'collections',collId,'documents'"],
    ['/schemas/{schemaId}/fields', "'schemas',schemaId,'fields'"],
    ['/groups/{groupId}/members', "'groups',groupId,'members'"],
    ['/roles/{roleId}/permissions', "'roles',roleId,'permissions'"],
    ['/policies/{policyId}/rules', "'policies',policyId,'rules'"],
    ['/triggers/{triggerId}/runs', "'triggers',triggerId,'runs'"],
    ['/secrets/{secretId}/versions', "'secrets',secretId,'versions'"],
    ['/functions/{functionId}/invoke', "'functions',functionId,'invoke'"],
    ['/layers/{layerId}/features', "'layers',layerId,'features'"],
    ['/datasets/{datasetId}/rows', "'datasets',datasetId,'rows'"],
    ['/models/{modelId}/predict', "'models',modelId,'predict'"],
    ['/experiments/{expId}/metrics', "'experiments',expId,'metrics'"],
    ['/notebooks/{nbId}/cells', "'notebooks',nbId,'cells'"],
    ['/queues/{queueId}/messages', "'queues',queueId,'messages'"],
    ['/topics/{topicId}/subscriptions', "'topics',topicId,'subscriptions'"],
    ['/streams/{streamId}/records', "'streams',streamId,'records'"],
    ['/vaults/{vaultId}/keys', "'vaults',vaultId,'keys'"],
  ])('single param: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 3. Parameter with SUFFIX (dash) — Issue #883 core — 50 cases
// ============================================================
describe('3. Parameter with dash suffix (Issue #883 core)', () => {
  test.each([
    ['/api/v1/user/{urlType}-url', "'api','v1','user',urlType,'-url'"],
    ['/api/{id}-details', "'api',id,'-details'"],
    ['/users/{userId}-profile', "'users',userId,'-profile'"],
    ['/items/{itemId}-info', "'items',itemId,'-info'"],
    ['/files/{fileId}-download', "'files',fileId,'-download'"],
    ['/reports/{reportId}-summary', "'reports',reportId,'-summary'"],
    ['/images/{imageId}-thumb', "'images',imageId,'-thumb'"],
    ['/docs/{docId}-preview', "'docs',docId,'-preview'"],
    ['/tasks/{taskId}-status', "'tasks',taskId,'-status'"],
    ['/events/{eventId}-log', "'events',eventId,'-log'"],
    ['/api/{version}-beta', "'api',version,'-beta'"],
    ['/nodes/{nodeId}-health', "'nodes',nodeId,'-health'"],
    ['/builds/{buildId}-artifacts', "'builds',buildId,'-artifacts'"],
    ['/runs/{runId}-output', "'runs',runId,'-output'"],
    ['/jobs/{jobId}-result', "'jobs',jobId,'-result'"],
    ['/alerts/{alertId}-ack', "'alerts',alertId,'-ack'"],
    ['/tokens/{tokenId}-revoke', "'tokens',tokenId,'-revoke'"],
    ['/keys/{keyId}-rotate', "'keys',keyId,'-rotate'"],
    ['/certs/{certId}-renew', "'certs',certId,'-renew'"],
    ['/hooks/{hookId}-test', "'hooks',hookId,'-test'"],
    ['/apps/{appId}-deploy', "'apps',appId,'-deploy'"],
    ['/flows/{flowId}-trigger', "'flows',flowId,'-trigger'"],
    ['/rules/{ruleId}-evaluate', "'rules',ruleId,'-evaluate'"],
    ['/plans/{planId}-activate', "'plans',planId,'-activate'"],
    ['/batches/{batchId}-process', "'batches',batchId,'-process'"],
    ['/scans/{scanId}-report', "'scans',scanId,'-report'"],
    ['/audits/{auditId}-export', "'audits',auditId,'-export'"],
    ['/migrations/{migId}-rollback', "'migrations',migId,'-rollback'"],
    ['/snapshots/{snapId}-restore', "'snapshots',snapId,'-restore'"],
    ['/backups/{backupId}-verify', "'backups',backupId,'-verify'"],
    ['/deploys/{deployId}-promote', "'deploys',deployId,'-promote'"],
    ['/releases/{releaseId}-notes', "'releases',releaseId,'-notes'"],
    ['/patches/{patchId}-apply', "'patches',patchId,'-apply'"],
    ['/updates/{updateId}-check', "'updates',updateId,'-check'"],
    ['/imports/{importId}-status', "'imports',importId,'-status'"],
    ['/exports/{exportId}-download', "'exports',exportId,'-download'"],
    ['/syncs/{syncId}-progress', "'syncs',syncId,'-progress'"],
    ['/transforms/{transformId}-run', "'transforms',transformId,'-run'"],
    ['/validations/{valId}-result', "'validations',valId,'-result'"],
    ['/approvals/{approvalId}-grant', "'approvals',approvalId,'-grant'"],
    ['/reviews/{reviewId}-submit', "'reviews',reviewId,'-submit'"],
    ['/ratings/{ratingId}-details', "'ratings',ratingId,'-details'"],
    ['/votes/{voteId}-tally', "'votes',voteId,'-tally'"],
    ['/comments/{commentId}-thread', "'comments',commentId,'-thread'"],
    ['/replies/{replyId}-parent', "'replies',replyId,'-parent'"],
    ['/tags/{tagId}-children', "'tags',tagId,'-children'"],
    ['/labels/{labelId}-items', "'labels',labelId,'-items'"],
    ['/categories/{catId}-tree', "'categories',catId,'-tree'"],
    ['/filters/{filterId}-apply', "'filters',filterId,'-apply'"],
    ['/queries/{queryId}-execute', "'queries',queryId,'-execute'"],
  ])('dash suffix: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 4. Parameter with dot suffix — 40 cases
// ============================================================
describe('4. Parameter with dot suffix', () => {
  test.each([
    ['/files/{fileId}.json', "'files',fileId,'.json'"],
    ['/files/{fileId}.xml', "'files',fileId,'.xml'"],
    ['/pages/{pageId}.html', "'pages',pageId,'.html'"],
    ['/assets/{assetId}.png', "'assets',assetId,'.png'"],
    ['/scripts/{name}.js', "'scripts',name,'.js'"],
    ['/styles/{name}.css', "'styles',name,'.css'"],
    ['/templates/{tplId}.hbs', "'templates',tplId,'.hbs'"],
    ['/images/{imgId}.jpg', "'images',imgId,'.jpg'"],
    ['/images/{imgId}.webp', "'images',imgId,'.webp'"],
    ['/images/{imgId}.svg', "'images',imgId,'.svg'"],
    ['/images/{imgId}.gif', "'images',imgId,'.gif'"],
    ['/videos/{vidId}.mp4', "'videos',vidId,'.mp4'"],
    ['/audio/{audioId}.mp3', "'audio',audioId,'.mp3'"],
    ['/docs/{docId}.pdf', "'docs',docId,'.pdf'"],
    ['/docs/{docId}.docx', "'docs',docId,'.docx'"],
    ['/sheets/{sheetId}.xlsx', "'sheets',sheetId,'.xlsx'"],
    ['/data/{dataId}.csv', "'data',dataId,'.csv'"],
    ['/data/{dataId}.tsv', "'data',dataId,'.tsv'"],
    ['/data/{dataId}.parquet', "'data',dataId,'.parquet'"],
    ['/configs/{cfgId}.yaml', "'configs',cfgId,'.yaml'"],
    ['/configs/{cfgId}.toml', "'configs',cfgId,'.toml'"],
    ['/configs/{cfgId}.ini', "'configs',cfgId,'.ini'"],
    ['/schemas/{schemaId}.graphql', "'schemas',schemaId,'.graphql'"],
    ['/schemas/{schemaId}.proto', "'schemas',schemaId,'.proto'"],
    ['/schemas/{schemaId}.avsc', "'schemas',schemaId,'.avsc'"],
    ['/reports/{rptId}.html', "'reports',rptId,'.html'"],
    ['/reports/{rptId}.pdf', "'reports',rptId,'.pdf'"],
    ['/certs/{certId}.pem', "'certs',certId,'.pem'"],
    ['/certs/{certId}.crt', "'certs',certId,'.crt'"],
    ['/keys/{keyId}.pub', "'keys',keyId,'.pub'"],
    ['/logs/{logId}.log', "'logs',logId,'.log'"],
    ['/logs/{logId}.gz', "'logs',logId,'.gz'"],
    ['/archives/{archiveId}.zip', "'archives',archiveId,'.zip'"],
    ['/archives/{archiveId}.tar', "'archives',archiveId,'.tar'"],
    ['/bundles/{bundleId}.wasm', "'bundles',bundleId,'.wasm'"],
    ['/bundles/{bundleId}.mjs', "'bundles',bundleId,'.mjs'"],
    ['/maps/{mapId}.geojson', "'maps',mapId,'.geojson'"],
    ['/feeds/{feedId}.rss', "'feeds',feedId,'.rss'"],
    ['/feeds/{feedId}.atom', "'feeds',feedId,'.atom'"],
    ['/manifests/{mfId}.json', "'manifests',mfId,'.json'"],
  ])('dot suffix: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 5. Parameter with underscore/other suffix — 30 cases
// ============================================================
describe('5. Parameter with underscore and other suffixes', () => {
  test.each([
    ['/data/{dataId}_v2', "'data',dataId,'_v2'"],
    ['/records/{recId}_backup', "'records',recId,'_backup'"],
    ['/logs/{logId}_archived', "'logs',logId,'_archived'"],
    ['/snapshots/{snapId}_latest', "'snapshots',snapId,'_latest'"],
    ['/models/{modelId}_trained', "'models',modelId,'_trained'"],
    ['/configs/{cfgId}_default', "'configs',cfgId,'_default'"],
    ['/templates/{tplId}_draft', "'templates',tplId,'_draft'"],
    ['/exports/{expId}_final', "'exports',expId,'_final'"],
    ['/reports/{rptId}_annual', "'reports',rptId,'_annual'"],
    ['/builds/{buildId}_debug', "'builds',buildId,'_debug'"],
    ['/builds/{buildId}_release', "'builds',buildId,'_release'"],
    ['/cache/{cacheId}_warm', "'cache',cacheId,'_warm'"],
    ['/cache/{cacheId}_cold', "'cache',cacheId,'_cold'"],
    ['/images/{imgId}_original', "'images',imgId,'_original'"],
    ['/images/{imgId}_thumbnail', "'images',imgId,'_thumbnail'"],
    ['/images/{imgId}_cropped', "'images',imgId,'_cropped'"],
    ['/docs/{docId}_signed', "'docs',docId,'_signed'"],
    ['/docs/{docId}_reviewed', "'docs',docId,'_reviewed'"],
    ['/tests/{testId}_passed', "'tests',testId,'_passed'"],
    ['/tests/{testId}_failed', "'tests',testId,'_failed'"],
    // Mixed suffix types
    ['/files/{fileId}.tar.gz', "'files',fileId,'.tar.gz'"],
    ['/files/{fileId}.min.js', "'files',fileId,'.min.js'"],
    ['/files/{fileId}.min.css', "'files',fileId,'.min.css'"],
    ['/files/{fileId}.d.ts', "'files',fileId,'.d.ts'"],
    ['/files/{fileId}.test.js', "'files',fileId,'.test.js'"],
    ['/files/{fileId}.spec.ts', "'files',fileId,'.spec.ts'"],
    ['/api/{id}-v2-beta', "'api',id,'-v2-beta'"],
    ['/api/{id}-rc1', "'api',id,'-rc1'"],
    ['/api/{id}-alpha', "'api',id,'-alpha'"],
    ['/api/{id}-stable', "'api',id,'-stable'"],
  ])('other suffix: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 6. Parameter with PREFIX — 40 cases
// ============================================================
describe('6. Parameter with prefix', () => {
  test.each([
    ['/api/v{version}/test', "'api','v',version,'test'"],
    ['/api/user-{userId}', "'api','user-',userId"],
    ['/prefix-{param}/next', "'prefix-',param,'next'"],
    ['/item_{itemId}/detail', "'item_',itemId,'detail'"],
    ['/org-{orgId}/members', "'org-',orgId,'members'"],
    ['/ns-{namespace}/pods', "'ns-',namespace,'pods'"],
    ['/env-{envId}/vars', "'env-',envId,'vars'"],
    ['/db-{dbName}/tables', "'db-',dbName,'tables'"],
    ['/cluster-{cid}/nodes', "'cluster-',cid,'nodes'"],
    ['/region-{rid}/zones', "'region-',rid,'zones'"],
    ['/app-{appId}/deploy', "'app-',appId,'deploy'"],
    ['/svc-{svcId}/logs', "'svc-',svcId,'logs'"],
    ['/key-{keyId}/value', "'key-',keyId,'value'"],
    ['/tag-{tagId}/items', "'tag-',tagId,'items'"],
    ['/pool-{poolId}/workers', "'pool-',poolId,'workers'"],
    ['/queue-{queueId}/messages', "'queue-',queueId,'messages'"],
    ['/cache-{cacheId}/entries', "'cache-',cacheId,'entries'"],
    ['/slot-{slotId}/config', "'slot-',slotId,'config'"],
    ['/rule-{ruleId}/actions', "'rule-',ruleId,'actions'"],
    ['/step-{stepId}/output', "'step-',stepId,'output'"],
    ['/project-{pid}/tasks', "'project-',pid,'tasks'"],
    ['/team-{tid}/members', "'team-',tid,'members'"],
    ['/account-{aid}/billing', "'account-',aid,'billing'"],
    ['/workspace-{wid}/boards', "'workspace-',wid,'boards'"],
    ['/pipeline-{plid}/stages', "'pipeline-',plid,'stages'"],
    ['/workflow-{wfId}/steps', "'workflow-',wfId,'steps'"],
    ['/dataset-{dsId}/records', "'dataset-',dsId,'records'"],
    ['/model-{mdlId}/versions', "'model-',mdlId,'versions'"],
    ['/function-{fnId}/invocations', "'function-',fnId,'invocations'"],
    ['/trigger-{trgId}/history', "'trigger-',trgId,'history'"],
    ['/secret-{secId}/access', "'secret-',secId,'access'"],
    ['/policy-{polId}/evaluate', "'policy-',polId,'evaluate'"],
    ['/role-{roleId}/bindings', "'role-',roleId,'bindings'"],
    ['/group-{grpId}/users', "'group-',grpId,'users'"],
    ['/layer-{lyrId}/features', "'layer-',lyrId,'features'"],
    ['/index-{idxId}/search', "'index-',idxId,'search'"],
    ['/shard-{shardId}/status', "'shard-',shardId,'status'"],
    ['/replica-{repId}/sync', "'replica-',repId,'sync'"],
    ['/partition-{partId}/data', "'partition-',partId,'data'"],
    ['/volume-{volId}/mount', "'volume-',volId,'mount'"],
  ])('prefix: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 7. Parameter with BOTH prefix and suffix — 40 cases
// ============================================================
describe('7. Parameter with both prefix and suffix', () => {
  test.each([
    ['/api/user-{id}-profile', "'api','user-',id,'-profile'"],
    ['/api/v{version}-beta', "'api','v',version,'-beta'"],
    ['/item_{id}-detail', "'item_',id,'-detail'"],
    ['/pre-{param}-post', "'pre-',param,'-post'"],
    ['/i18n-{locale}.js', "'i18n-',locale,'.js'"],
    ['/app-{id}-config', "'app-',id,'-config'"],
    ['/ns-{name}-pods', "'ns-',name,'-pods'"],
    ['/env-{id}-vars', "'env-',id,'-vars'"],
    ['/svc-{name}-health', "'svc-',name,'-health'"],
    ['/db-{name}-backup', "'db-',name,'-backup'"],
    ['/res-{id}-meta', "'res-',id,'-meta'"],
    ['/obj-{key}-value', "'obj-',key,'-value'"],
    ['/cfg-{name}-default', "'cfg-',name,'-default'"],
    ['/tpl-{id}-render', "'tpl-',id,'-render'"],
    ['/job-{id}-status', "'job-',id,'-status'"],
    ['/run-{id}-logs', "'run-',id,'-logs'"],
    ['/task-{id}-result', "'task-',id,'-result'"],
    ['/hook-{id}-trigger', "'hook-',id,'-trigger'"],
    ['/key-{id}-rotate', "'key-',id,'-rotate'"],
    ['/cert-{id}-verify', "'cert-',id,'-verify'"],
    ['/file-{id}.json', "'file-',id,'.json'"],
    ['/file-{id}.xml', "'file-',id,'.xml'"],
    ['/img-{id}.png', "'img-',id,'.png'"],
    ['/img-{id}.webp', "'img-',id,'.webp'"],
    ['/doc-{id}.pdf', "'doc-',id,'.pdf'"],
    ['/report-{id}.csv', "'report-',id,'.csv'"],
    ['/export-{id}.xlsx', "'export-',id,'.xlsx'"],
    ['/log-{id}.gz', "'log-',id,'.gz'"],
    ['/archive-{id}.zip', "'archive-',id,'.zip'"],
    ['/bundle-{id}.wasm', "'bundle-',id,'.wasm'"],
    ['/v{ver}-release', "'v',ver,'-release'"],
    ['/v{ver}-rc', "'v',ver,'-rc'"],
    ['/v{ver}-alpha', "'v',ver,'-alpha'"],
    ['/v{ver}-patch', "'v',ver,'-patch'"],
    ['/v{ver}.json', "'v',ver,'.json'"],
    ['/api-{group}-v2', "'api-',group,'-v2'"],
    ['/svc-{name}-internal', "'svc-',name,'-internal'"],
    ['/ns-{name}-default', "'ns-',name,'-default'"],
    ['/cluster-{id}-primary', "'cluster-',id,'-primary'"],
    ['/region-{id}-fallback', "'region-',id,'-fallback'"],
  ])('prefix+suffix: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 8. Multiple parameters in one segment — 50 cases
// ============================================================
describe('8. Multiple parameters in one segment', () => {
  test.each([
    // Two params with dash
    ['/api/{param1}-{param2}', "'api',param1,'-',param2"],
    ['/range/{start}-{end}', "'range',start,'-',end"],
    ['/i18n/{lang}-{region}', "'i18n',lang,'-',region"],
    ['/api/{owner}-{repo}', "'api',owner,'-',repo"],
    ['/api/{schema}-{table}', "'api',schema,'-',table"],
    ['/compare/{base}-{head}', "'compare',base,'-',head"],
    ['/diff/{before}-{after}', "'diff',before,'-',after"],
    ['/merge/{source}-{target}', "'merge',source,'-',target"],
    ['/copy/{from}-{to}', "'copy',from,'-',to"],
    ['/swap/{left}-{right}', "'swap',left,'-',right"],
    // Two params with dot
    ['/files/{name}.{ext}', "'files',name,'.',ext"],
    ['/api/{first}.{last}', "'api',first,'.',last"],
    ['/v{major}.{minor}', "'v',major,'.',minor"],
    ['/dns/{subdomain}.{domain}', "'dns',subdomain,'.',domain"],
    ['/path/{parent}.{child}', "'path',parent,'.',child"],
    // Two params with underscore
    ['/api/{first}_{last}', "'api',first,'_',last"],
    ['/keys/{namespace}_{key}', "'keys',namespace,'_',key"],
    ['/metrics/{source}_{metric}', "'metrics',source,'_',metric"],
    ['/tags/{category}_{tag}', "'tags',category,'_',tag"],
    ['/vars/{scope}_{name}', "'vars',scope,'_',name"],
    // Two params with other separators
    ['/coords/{lat},{lng}', "'coords',lat,',',lng"],
    ['/geo/{lat}x{lng}', "'geo',lat,'x',lng"],
    ['/dims/{width}x{height}', "'dims',width,'x',height"],
    ['/pair/{left}+{right}', "'pair',left,'+',right"],
    ['/keys/{prefix}:{suffix}', "'keys',prefix,':',suffix"],
    ['/tags/{ns}:{tag}', "'tags',ns,':',tag"],
    ['/ref/{org}:{project}', "'ref',org,':',project"],
    ['/search/{field}={value}', "'search',field,'=',value"],
    ['/filter/{key}={val}', "'filter',key,'=',val"],
    ['/bind/{host}:{port}', "'bind',host,':',port"],
    // Three params
    ['/api/{a}-{b}-{c}', "'api',a,'-',b,'-',c"],
    ['/api/{year}-{month}-{day}', "'api',year,'-',month,'-',day"],
    ['/api/{major}.{minor}.{patch}', "'api',major,'.',minor,'.',patch"],
    ['/color/{red}-{green}-{blue}', "'color',red,'-',green,'-',blue"],
    ['/date/{y}-{m}-{d}', "'date',y,'-',m,'-',d"],
    ['/time/{h}:{m}:{s}', "'time',h,':',m,':',s"],
    ['/rgb/{r}.{g}.{b}', "'rgb',r,'.',g,'.',b"],
    ['/ip/{a}.{b}.{c}', "'ip',a,'.',b,'.',c"],
    ['/coord/{x}-{y}-{z}', "'coord',x,'-',y,'-',z"],
    ['/version/{major}-{minor}-{patch}', "'version',major,'-',minor,'-',patch"],
    // Params with prefix/suffix in segment
    [
      '/api/user{param1}-{param2}.html',
      "'api','user',param1,'-',param2,'.html'",
    ],
    ['/api/v{major}.{minor}-rc', "'api','v',major,'.',minor,'-rc'"],
    ['/api/pre-{a}-{b}-post', "'api','pre-',a,'-',b,'-post'"],
    ['/date/{y}-{m}-{d}/events', "'date',y,'-',m,'-',d,'events'"],
    [
      '/api/v1/{param1}-{param2}/resource',
      "'api','v1',param1,'-',param2,'resource'",
    ],
    // Four params
    ['/ip/{a}.{b}.{c}.{d}', "'ip',a,'.',b,'.',c,'.',d"],
    ['/uuid/{a}-{b}-{c}-{d}', "'uuid',a,'-',b,'-',c,'-',d"],
    ['/path/{a}_{b}_{c}_{d}', "'path',a,'_',b,'_',c,'_',d"],
    ['/rgba/{r}.{g}.{b}.{a}', "'rgba',r,'.',g,'.',b,'.',a"],
    ['/rect/{x1}-{y1}-{x2}-{y2}', "'rect',x1,'-',y1,'-',x2,'-',y2"],
  ])('multi-param segment: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 9. Multiple segments with mixed params — 50 cases
// ============================================================
describe('9. Multiple segments with mixed params', () => {
  test.each([
    ['/api/{version}/users/{userId}', "'api',version,'users',userId"],
    ['/api/v{ver}/users/{uid}-profile', "'api','v',ver,'users',uid,'-profile'"],
    ['/{tenant}/api/v{ver}/{resource}', "tenant,'api','v',ver,resource"],
    ['/orgs/{orgId}/repos/{repoId}', "'orgs',orgId,'repos',repoId"],
    [
      '/orgs/{orgId}/repos/{repoId}/branches/{branch}',
      "'orgs',orgId,'repos',repoId,'branches',branch",
    ],
    ['/api/v1/{a}-{b}/nested/{c}-{d}', "'api','v1',a,'-',b,'nested',c,'-',d"],
    ['/ns-{ns}/pods/{podId}-logs', "'ns-',ns,'pods',podId,'-logs'"],
    ['/v{ver}/items/{id}.json', "'v',ver,'items',id,'.json'"],
    ['/api/{group}/v{ver}/resource', "'api',group,'v',ver,'resource'"],
    ['/{a}/{b}/{c}/{d}', 'a,b,c,d'],
    ['/pre-{x}/mid/{y}-post', "'pre-',x,'mid',y,'-post'"],
    ['/{org}/projects/{pid}/tasks/{tid}', "org,'projects',pid,'tasks',tid"],
    [
      '/regions/{rid}/clusters/{cid}/nodes/{nid}',
      "'regions',rid,'clusters',cid,'nodes',nid",
    ],
    [
      '/api/v{v}/users/{uid}/posts/{pid}',
      "'api','v',v,'users',uid,'posts',pid",
    ],
    [
      '/teams/{tid}/channels/{cid}/messages/{mid}',
      "'teams',tid,'channels',cid,'messages',mid",
    ],
    ['/{a}-{b}/{c}-{d}', "a,'-',b,c,'-',d"],
    [
      '/api/v1/users/{userId}/roles/{roleId}',
      "'api','v1','users',userId,'roles',roleId",
    ],
    [
      '/db-{dbId}/tables/{tblId}/rows/{rowId}',
      "'db-',dbId,'tables',tblId,'rows',rowId",
    ],
    ['/env-{env}/svc-{svc}/health', "'env-',env,'svc-',svc,'health'"],
    [
      '/{tenant}/api/v{ver}/res/{id}-detail',
      "tenant,'api','v',ver,'res',id,'-detail'",
    ],
    [
      '/api/{ver}/accounts/{aid}/projects/{pid}',
      "'api',ver,'accounts',aid,'projects',pid",
    ],
    ['/v{ver}/orgs/{oid}/teams/{tid}', "'v',ver,'orgs',oid,'teams',tid"],
    ['/{tenant}/v{ver}/users/{uid}', "tenant,'v',ver,'users',uid"],
    ['/api/v{ver}/{type}-{id}/details', "'api','v',ver,type,'-',id,'details'"],
    ['/ns-{ns}/svc-{svc}/pods/{podId}', "'ns-',ns,'svc-',svc,'pods',podId"],
    [
      '/cluster-{cid}/ns-{ns}/deploy/{did}',
      "'cluster-',cid,'ns-',ns,'deploy',did",
    ],
    [
      '/regions/{rid}/zones/{zid}/instances/{iid}',
      "'regions',rid,'zones',zid,'instances',iid",
    ],
    [
      '/projects/{pid}/repos/{rid}/branches/{bid}/commits/{cid}',
      "'projects',pid,'repos',rid,'branches',bid,'commits',cid",
    ],
    ['/api/v{ver}/files/{fid}.{ext}', "'api','v',ver,'files',fid,'.',ext"],
    [
      '/{org}/{repo}/pulls/{prNum}/reviews/{revId}',
      "org,repo,'pulls',prNum,'reviews',revId",
    ],
    ['/api/{ver}/items/{id}-info/sub', "'api',ver,'items',id,'-info','sub'"],
    ['/{a}-x/{b}-y/{c}-z', "a,'-x',b,'-y',c,'-z'"],
    ['/pre-{a}/mid-{b}/post-{c}', "'pre-',a,'mid-',b,'post-',c"],
    ['/api/{g1}-{g2}/v{ver}/data', "'api',g1,'-',g2,'v',ver,'data'"],
    ['/v{major}.{minor}/api/{resource}', "'v',major,'.',minor,'api',resource"],
    [
      '/{tenant}/api/{group}/v{ver}/items/{id}',
      "tenant,'api',group,'v',ver,'items',id",
    ],
    [
      '/svc-{svc}/ns-{ns}/pods/{pid}-logs',
      "'svc-',svc,'ns-',ns,'pods',pid,'-logs'",
    ],
    ['/app-{app}/env-{env}/config/{key}', "'app-',app,'env-',env,'config',key"],
    ['/api/v1/{a}/{b}-detail/{c}.json', "'api','v1',a,b,'-detail',c,'.json'"],
    [
      '/{org}/projects/{pid}/envs/{eid}/deploys/{did}',
      "org,'projects',pid,'envs',eid,'deploys',did",
    ],
    [
      '/api/v{ver}/users/{uid}/posts/{pid}/comments/{cid}',
      "'api','v',ver,'users',uid,'posts',pid,'comments',cid",
    ],
    [
      '/regions/{rid}/clusters/{cid}/ns-{ns}/pods/{pid}',
      "'regions',rid,'clusters',cid,'ns-',ns,'pods',pid",
    ],
    ['/{a}-{b}/{c}/{d}-{e}', "a,'-',b,c,d,'-',e"],
    [
      '/api/{ver}/date/{y}-{m}-{d}/events/{eid}',
      "'api',ver,'date',y,'-',m,'-',d,'events',eid",
    ],
    ['/v{ver}/coords/{lat},{lng}/info', "'v',ver,'coords',lat,',',lng,'info'"],
    [
      '/api/{ver}/range/{start}-{end}/items',
      "'api',ver,'range',start,'-',end,'items'",
    ],
    [
      '/api/v1/compare/{base}-{head}/diff',
      "'api','v1','compare',base,'-',head,'diff'",
    ],
    [
      '/orgs/{oid}/teams/{tid}/members/{mid}/roles',
      "'orgs',oid,'teams',tid,'members',mid,'roles'",
    ],
    [
      '/api/{ver}/files/{name}.{ext}/download',
      "'api',ver,'files',name,'.',ext,'download'",
    ],
    [
      '/ns-{ns}/svc-{svc}/pods/{pid}-status/logs',
      "'ns-',ns,'svc-',svc,'pods',pid,'-status','logs'",
    ],
  ])('mixed: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 10. Deep nested paths — 30 cases
// ============================================================
describe('10. Deep nested paths', () => {
  test.each([
    ['/a/b/c/d/e/f/g', "'a','b','c','d','e','f','g'"],
    [
      '/api/v1/orgs/{oid}/teams/{tid}/members/{mid}/roles/{rid}',
      "'api','v1','orgs',oid,'teams',tid,'members',mid,'roles',rid",
    ],
    ['/api/v1/a/b/c/{id}', "'api','v1','a','b','c',id"],
    ['/{a}/{b}/{c}/{d}/{e}', 'a,b,c,d,e'],
    ['/x/y/z/{p1}/w/{p2}/v/{p3}', "'x','y','z',p1,'w',p2,'v',p3"],
    [
      '/api/v1/projects/{pid}/envs/{eid}/services/{sid}/instances/{iid}',
      "'api','v1','projects',pid,'envs',eid,'services',sid,'instances',iid",
    ],
    [
      '/level1/level2/level3/level4/level5',
      "'level1','level2','level3','level4','level5'",
    ],
    ['/api/v{v}/a-{x}/b/{y}-c/d', "'api','v',v,'a-',x,'b',y,'-c','d'"],
    ['/root/{a}/sub/{b}/leaf/{c}/meta', "'root',a,'sub',b,'leaf',c,'meta'"],
    [
      '/api/v2/accounts/{aid}/projects/{pid}/builds/{bid}/logs',
      "'api','v2','accounts',aid,'projects',pid,'builds',bid,'logs'",
    ],
    [
      '/{org}/{repo}/tree/{branch}/path/{file}',
      "org,repo,'tree',branch,'path',file",
    ],
    ['/api/v1/a/b/{x}/c/d/{y}/e', "'api','v1','a','b',x,'c','d',y,'e'"],
    [
      '/deeply/nested/static/path/with/many/segments',
      "'deeply','nested','static','path','with','many','segments'",
    ],
    ['/api/v1/{a}/{b}/{c}/{d}/{e}/{f}', "'api','v1',a,b,c,d,e,f"],
    ['/a-{x}/b-{y}/c-{z}', "'a-',x,'b-',y,'c-',z"],
    ['/1/2/3/4/5/6/7/8', "'1','2','3','4','5','6','7','8'"],
    ['/{a}/{b}/{c}/{d}/{e}/{f}/{g}/{h}', 'a,b,c,d,e,f,g,h'],
    ['/api/v1/a/b/c/d/e/f/g/h', "'api','v1','a','b','c','d','e','f','g','h'"],
    [
      '/ns-{ns}/svc-{svc}/pod-{pod}/container-{ctn}/exec',
      "'ns-',ns,'svc-',svc,'pod-',pod,'container-',ctn,'exec'",
    ],
    ['/a-{w}/b-{x}/c-{y}/d-{z}/final', "'a-',w,'b-',x,'c-',y,'d-',z,'final'"],
    [
      '/api/v{v}/region-{r}/zone-{z}/cluster-{c}/ns-{n}/svc/{s}',
      "'api','v',v,'region-',r,'zone-',z,'cluster-',c,'ns-',n,'svc',s",
    ],
    [
      '/root/sub1/sub2/sub3/{id}/action',
      "'root','sub1','sub2','sub3',id,'action'",
    ],
    [
      '/{t}/api/v{v}/group/{g}/resource/{r}/sub/{s}/item/{i}',
      "t,'api','v',v,'group',g,'resource',r,'sub',s,'item',i",
    ],
    ['/api/v1/{a}-{b}/{c}-{d}/{e}-{f}', "'api','v1',a,'-',b,c,'-',d,e,'-',f"],
    [
      '/x/{p1}.{p2}/y/{p3}.{p4}/z/{p5}.{p6}',
      "'x',p1,'.',p2,'y',p3,'.',p4,'z',p5,'.',p6",
    ],
    [
      '/very/deep/static/path/that/goes/on/and/on/and/on',
      "'very','deep','static','path','that','goes','on','and','on','and','on'",
    ],
    [
      '/api/v1/orgs/{oid}/projects/{pid}/envs/{eid}/deploys/{did}/instances/{iid}/logs',
      "'api','v1','orgs',oid,'projects',pid,'envs',eid,'deploys',did,'instances',iid,'logs'",
    ],
    [
      '/a/b/c/{x}/d/e/f/{y}/g/h/i/{z}',
      "'a','b','c',x,'d','e','f',y,'g','h','i',z",
    ],
    [
      '/level1/{l1}/level2/{l2}/level3/{l3}/level4/{l4}/leaf',
      "'level1',l1,'level2',l2,'level3',l3,'level4',l4,'leaf'",
    ],
    [
      '/pre-{a}/static1/{b}-suf/static2/pre-{c}-suf/static3',
      "'pre-',a,'static1',b,'-suf','static2','pre-',c,'-suf','static3'",
    ],
  ])('deep: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 11. Edge cases — 30 cases
// ============================================================
describe('11. Edge cases', () => {
  test.each([
    ['api', "'api'"],
    ['/{id}', 'id'],
    ['/items/{id}-v2', "'items',id,'-v2'"],
    ['/api/v1/2024/data', "'api','v1','2024','data'"],
    ['/api/v1.0/users', "'api','v1.0','users'"],
    ['/api/user_data/list', "'api','user_data','list'"],
    ['/api/my-resource/items', "'api','my-resource','items'"],
    ['/{onlyParam}', 'onlyParam'],
    ['/api/test', "'api','test'"],
    ['/users/{user_id}', "'users',userId"],
    ['/api/{path*}', "'api',path"],
    ['/api/{id}-very-long-suffix', "'api',id,'-very-long-suffix'"],
    ['/api/very-long-prefix-{id}', "'api','very-long-prefix-',id"],
    ['/api/pre-{id}-post-fix', "'api','pre-',id,'-post-fix'"],
    ['/files/{name}.tar.gz', "'files',name,'.tar.gz'"],
    // Single char segments
    ['/a', "'a'"],
    ['/a/b', "'a','b'"],
    ['/a/b/c', "'a','b','c'"],
    // Numbers as segments
    ['/1', "'1'"],
    ['/1/2/3', "'1','2','3'"],
    ['/api/v1/123/456', "'api','v1','123','456'"],
    // Very short param names
    ['/api/{a}', "'api',a"],
    ['/api/{x}/{y}', "'api',x,y"],
    // Param at every position
    ['/{first}/middle/{last}', "first,'middle',last"],
    ['/{a}/static/{b}/static2/{c}', "a,'static',b,'static2',c"],
    // Adjacent segments with same param patterns
    ['/api/{id1}/{id2}/{id3}', "'api',id1,id2,id3"],
    // Long static segment names
    [
      '/very-long-segment-name/another-long-name',
      "'very-long-segment-name','another-long-name'",
    ],
    // Segment with multiple hyphens
    [
      '/api/my-very-long-resource-name/items',
      "'api','my-very-long-resource-name','items'",
    ],
    // Segment with multiple underscores
    ['/api/my_resource_v2_beta/items', "'api','my_resource_v2_beta','items'"],
    // Segment with mixed separators
    ['/api/resource-v2_beta/items', "'api','resource-v2_beta','items'"],
  ])('edge: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 12. Real-world: GitHub / Git APIs — 40 cases
// ============================================================
describe('12. Real-world: GitHub/Git APIs', () => {
  test.each([
    [
      '/repos/{owner}/{repo}/pulls/{pullNumber}',
      "'repos',owner,repo,'pulls',pullNumber",
    ],
    [
      '/repos/{owner}/{repo}/git/refs/{ref}',
      "'repos',owner,repo,'git','refs',ref",
    ],
    ['/users/{username}/repos', "'users',username,'repos'"],
    [
      '/repos/{owner}/{repo}/issues/{issueNumber}/comments',
      "'repos',owner,repo,'issues',issueNumber,'comments'",
    ],
    [
      '/repos/{owner}/{repo}/contents/{path}',
      "'repos',owner,repo,'contents',path",
    ],
    [
      '/repos/{owner}/{repo}/branches/{branch}',
      "'repos',owner,repo,'branches',branch",
    ],
    ['/repos/{owner}/{repo}/tags', "'repos',owner,repo,'tags'"],
    [
      '/repos/{owner}/{repo}/releases/{releaseId}',
      "'repos',owner,repo,'releases',releaseId",
    ],
    ['/repos/{owner}/{repo}/commits/{sha}', "'repos',owner,repo,'commits',sha"],
    [
      '/repos/{owner}/{repo}/compare/{base}...{head}',
      "'repos',owner,repo,'compare',base,'...',head",
    ],
    [
      '/repos/{owner}/{repo}/actions/runs/{runId}',
      "'repos',owner,repo,'actions','runs',runId",
    ],
    [
      '/repos/{owner}/{repo}/actions/workflows/{workflowId}',
      "'repos',owner,repo,'actions','workflows',workflowId",
    ],
    [
      '/repos/{owner}/{repo}/check-runs/{checkRunId}',
      "'repos',owner,repo,'check-runs',checkRunId",
    ],
    [
      '/repos/{owner}/{repo}/deployments/{deploymentId}',
      "'repos',owner,repo,'deployments',deploymentId",
    ],
    [
      '/repos/{owner}/{repo}/hooks/{hookId}',
      "'repos',owner,repo,'hooks',hookId",
    ],
    ['/repos/{owner}/{repo}/labels/{name}', "'repos',owner,repo,'labels',name"],
    [
      '/repos/{owner}/{repo}/milestones/{milestoneNumber}',
      "'repos',owner,repo,'milestones',milestoneNumber",
    ],
    [
      '/repos/{owner}/{repo}/pulls/{pullNumber}/reviews/{reviewId}',
      "'repos',owner,repo,'pulls',pullNumber,'reviews',reviewId",
    ],
    [
      '/repos/{owner}/{repo}/pulls/{pullNumber}/commits',
      "'repos',owner,repo,'pulls',pullNumber,'commits'",
    ],
    [
      '/repos/{owner}/{repo}/pulls/{pullNumber}/files',
      "'repos',owner,repo,'pulls',pullNumber,'files'",
    ],
    ['/orgs/{org}/repos', "'orgs',org,'repos'"],
    ['/orgs/{org}/members/{username}', "'orgs',org,'members',username"],
    ['/orgs/{org}/teams/{teamSlug}', "'orgs',org,'teams',teamSlug"],
    [
      '/orgs/{org}/teams/{teamSlug}/members/{username}',
      "'orgs',org,'teams',teamSlug,'members',username",
    ],
    ['/gists/{gistId}', "'gists',gistId"],
    [
      '/gists/{gistId}/comments/{commentId}',
      "'gists',gistId,'comments',commentId",
    ],
    ['/notifications/threads/{threadId}', "'notifications','threads',threadId"],
    [
      '/repos/{owner}/{repo}/git/trees/{treeSha}',
      "'repos',owner,repo,'git','trees',treeSha",
    ],
    [
      '/repos/{owner}/{repo}/git/blobs/{fileSha}',
      "'repos',owner,repo,'git','blobs',fileSha",
    ],
    [
      '/repos/{owner}/{repo}/git/commits/{commitSha}',
      "'repos',owner,repo,'git','commits',commitSha",
    ],
    ['/repos/{owner}/{repo}/stargazers', "'repos',owner,repo,'stargazers'"],
    ['/repos/{owner}/{repo}/subscribers', "'repos',owner,repo,'subscribers'"],
    ['/repos/{owner}/{repo}/forks', "'repos',owner,repo,'forks'"],
    [
      '/repos/{owner}/{repo}/collaborators/{username}',
      "'repos',owner,repo,'collaborators',username",
    ],
    [
      '/repos/{owner}/{repo}/invitations/{invitationId}',
      "'repos',owner,repo,'invitations',invitationId",
    ],
    ['/repos/{owner}/{repo}/pages', "'repos',owner,repo,'pages'"],
    [
      '/repos/{owner}/{repo}/traffic/views',
      "'repos',owner,repo,'traffic','views'",
    ],
    [
      '/repos/{owner}/{repo}/traffic/clones',
      "'repos',owner,repo,'traffic','clones'",
    ],
    [
      '/repos/{owner}/{repo}/vulnerability-alerts',
      "'repos',owner,repo,'vulnerability-alerts'",
    ],
    [
      '/repos/{owner}/{repo}/code-scanning/alerts/{alertNumber}',
      "'repos',owner,repo,'code-scanning','alerts',alertNumber",
    ],
  ])('github: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 13. Real-world: Kubernetes-like APIs — 40 cases
// ============================================================
describe('13. Real-world: Kubernetes-like APIs', () => {
  test.each([
    [
      '/apis/{group}/{version}/namespaces/{namespace}/pods/{name}',
      "'apis',group,version,'namespaces',namespace,'pods',name",
    ],
    [
      '/api/v1/namespaces/{namespace}/services/{name}/proxy',
      "'api','v1','namespaces',namespace,'services',name,'proxy'",
    ],
    [
      '/api/v1/namespaces/{namespace}/pods/{podName}/log',
      "'api','v1','namespaces',namespace,'pods',podName,'log'",
    ],
    [
      '/api/v1/namespaces/{namespace}/pods/{podName}/exec',
      "'api','v1','namespaces',namespace,'pods',podName,'exec'",
    ],
    [
      '/api/v1/namespaces/{namespace}/pods/{podName}/portforward',
      "'api','v1','namespaces',namespace,'pods',podName,'portforward'",
    ],
    [
      '/api/v1/namespaces/{namespace}/configmaps/{name}',
      "'api','v1','namespaces',namespace,'configmaps',name",
    ],
    [
      '/api/v1/namespaces/{namespace}/secrets/{name}',
      "'api','v1','namespaces',namespace,'secrets',name",
    ],
    [
      '/api/v1/namespaces/{namespace}/endpoints/{name}',
      "'api','v1','namespaces',namespace,'endpoints',name",
    ],
    [
      '/api/v1/namespaces/{namespace}/events/{name}',
      "'api','v1','namespaces',namespace,'events',name",
    ],
    [
      '/api/v1/namespaces/{namespace}/persistentvolumeclaims/{name}',
      "'api','v1','namespaces',namespace,'persistentvolumeclaims',name",
    ],
    [
      '/api/v1/namespaces/{namespace}/resourcequotas/{name}',
      "'api','v1','namespaces',namespace,'resourcequotas',name",
    ],
    [
      '/api/v1/namespaces/{namespace}/serviceaccounts/{name}',
      "'api','v1','namespaces',namespace,'serviceaccounts',name",
    ],
    ['/api/v1/nodes/{name}', "'api','v1','nodes',name"],
    ['/api/v1/nodes/{name}/status', "'api','v1','nodes',name,'status'"],
    ['/api/v1/persistentvolumes/{name}', "'api','v1','persistentvolumes',name"],
    [
      '/apis/apps/v1/namespaces/{namespace}/deployments/{name}',
      "'apis','apps','v1','namespaces',namespace,'deployments',name",
    ],
    [
      '/apis/apps/v1/namespaces/{namespace}/deployments/{name}/scale',
      "'apis','apps','v1','namespaces',namespace,'deployments',name,'scale'",
    ],
    [
      '/apis/apps/v1/namespaces/{namespace}/deployments/{name}/status',
      "'apis','apps','v1','namespaces',namespace,'deployments',name,'status'",
    ],
    [
      '/apis/apps/v1/namespaces/{namespace}/replicasets/{name}',
      "'apis','apps','v1','namespaces',namespace,'replicasets',name",
    ],
    [
      '/apis/apps/v1/namespaces/{namespace}/statefulsets/{name}',
      "'apis','apps','v1','namespaces',namespace,'statefulsets',name",
    ],
    [
      '/apis/apps/v1/namespaces/{namespace}/daemonsets/{name}',
      "'apis','apps','v1','namespaces',namespace,'daemonsets',name",
    ],
    [
      '/apis/batch/v1/namespaces/{namespace}/jobs/{name}',
      "'apis','batch','v1','namespaces',namespace,'jobs',name",
    ],
    [
      '/apis/batch/v1/namespaces/{namespace}/cronjobs/{name}',
      "'apis','batch','v1','namespaces',namespace,'cronjobs',name",
    ],
    [
      '/apis/networking.k8s.io/v1/namespaces/{namespace}/ingresses/{name}',
      "'apis','networking.k8s.io','v1','namespaces',namespace,'ingresses',name",
    ],
    [
      '/apis/networking.k8s.io/v1/namespaces/{namespace}/networkpolicies/{name}',
      "'apis','networking.k8s.io','v1','namespaces',namespace,'networkpolicies',name",
    ],
    [
      '/apis/rbac.authorization.k8s.io/v1/clusterroles/{name}',
      "'apis','rbac.authorization.k8s.io','v1','clusterroles',name",
    ],
    [
      '/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/{name}',
      "'apis','rbac.authorization.k8s.io','v1','clusterrolebindings',name",
    ],
    [
      '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/roles/{name}',
      "'apis','rbac.authorization.k8s.io','v1','namespaces',namespace,'roles',name",
    ],
    [
      '/apis/storage.k8s.io/v1/storageclasses/{name}',
      "'apis','storage.k8s.io','v1','storageclasses',name",
    ],
    [
      '/apis/autoscaling/v2/namespaces/{namespace}/horizontalpodautoscalers/{name}',
      "'apis','autoscaling','v2','namespaces',namespace,'horizontalpodautoscalers',name",
    ],
    [
      '/api/v1/namespaces/{namespace}/pods/{podName}/containers/{containerName}/logs',
      "'api','v1','namespaces',namespace,'pods',podName,'containers',containerName,'logs'",
    ],
    [
      '/apis/apps/v1/namespaces/{namespace}/deployments/{name}/rollback',
      "'apis','apps','v1','namespaces',namespace,'deployments',name,'rollback'",
    ],
    ['/api/v1/namespaces/{namespace}', "'api','v1','namespaces',namespace"],
    [
      '/apis/certificates.k8s.io/v1/certificatesigningrequests/{name}',
      "'apis','certificates.k8s.io','v1','certificatesigningrequests',name",
    ],
    [
      '/apis/policy/v1/namespaces/{namespace}/poddisruptionbudgets/{name}',
      "'apis','policy','v1','namespaces',namespace,'poddisruptionbudgets',name",
    ],
    [
      '/api/v1/namespaces/{namespace}/limitranges/{name}',
      "'api','v1','namespaces',namespace,'limitranges',name",
    ],
    [
      '/apis/admissionregistration.k8s.io/v1/validatingwebhookconfigurations/{name}',
      "'apis','admissionregistration.k8s.io','v1','validatingwebhookconfigurations',name",
    ],
    [
      '/apis/apiextensions.k8s.io/v1/customresourcedefinitions/{name}',
      "'apis','apiextensions.k8s.io','v1','customresourcedefinitions',name",
    ],
    ['/apis/{group}/{version}/{resource}', "'apis',group,version,resource"],
    [
      '/apis/{group}/{version}/namespaces/{namespace}/{resource}/{name}',
      "'apis',group,version,'namespaces',namespace,resource,name",
    ],
  ])('k8s: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 14. Real-world: Cloud provider APIs (AWS/Azure/GCP) — 40 cases
// ============================================================
describe('14. Real-world: Cloud provider APIs', () => {
  test.each([
    // AWS-style
    ['/buckets/{bucket}/objects/{key}', "'buckets',bucket,'objects',key"],
    [
      '/stacks/{stackName}/resources/{logicalId}',
      "'stacks',stackName,'resources',logicalId",
    ],
    [
      '/functions/{functionName}/invocations',
      "'functions',functionName,'invocations'",
    ],
    [
      '/functions/{functionName}/versions/{version}',
      "'functions',functionName,'versions',version",
    ],
    [
      '/functions/{functionName}/aliases/{aliasName}',
      "'functions',functionName,'aliases',aliasName",
    ],
    ['/tables/{tableName}/items/{itemId}', "'tables',tableName,'items',itemId"],
    ['/queues/{queueName}/messages', "'queues',queueName,'messages'"],
    ['/topics/{topicArn}/subscriptions', "'topics',topicArn,'subscriptions'"],
    ['/streams/{streamName}/records', "'streams',streamName,'records'"],
    [
      '/clusters/{clusterName}/services/{serviceName}',
      "'clusters',clusterName,'services',serviceName",
    ],
    [
      '/clusters/{clusterName}/tasks/{taskId}',
      "'clusters',clusterName,'tasks',taskId",
    ],
    [
      '/repositories/{repositoryName}/images/{imageId}',
      "'repositories',repositoryName,'images',imageId",
    ],
    ['/distributions/{distributionId}', "'distributions',distributionId"],
    [
      '/hosted-zones/{hostedZoneId}/recordsets',
      "'hosted-zones',hostedZoneId,'recordsets'",
    ],
    // Azure-style
    [
      '/subscriptions/{subId}/resourceGroups/{rgName}',
      "'subscriptions',subId,'resourceGroups',rgName",
    ],
    [
      '/subscriptions/{subId}/resourceGroups/{rgName}/providers/{provider}',
      "'subscriptions',subId,'resourceGroups',rgName,'providers',provider",
    ],
    [
      '/subscriptions/{subId}/providers/Microsoft.Compute/virtualMachines/{vmName}',
      "'subscriptions',subId,'providers','Microsoft.Compute','virtualMachines',vmName",
    ],
    [
      '/subscriptions/{subId}/providers/Microsoft.Storage/storageAccounts/{accountName}',
      "'subscriptions',subId,'providers','Microsoft.Storage','storageAccounts',accountName",
    ],
    [
      '/subscriptions/{subId}/providers/Microsoft.Network/virtualNetworks/{vnetName}',
      "'subscriptions',subId,'providers','Microsoft.Network','virtualNetworks',vnetName",
    ],
    [
      '/subscriptions/{subId}/providers/Microsoft.Web/sites/{siteName}',
      "'subscriptions',subId,'providers','Microsoft.Web','sites',siteName",
    ],
    [
      '/subscriptions/{subId}/providers/Microsoft.Sql/servers/{serverName}/databases/{dbName}',
      "'subscriptions',subId,'providers','Microsoft.Sql','servers',serverName,'databases',dbName",
    ],
    ['/tenants/{tenantId}/users/{userId}', "'tenants',tenantId,'users',userId"],
    // GCP-style
    [
      '/v1/projects/{projectId}/locations/{locationId}/datasets/{datasetId}',
      "'v1','projects',projectId,'locations',locationId,'datasets',datasetId",
    ],
    [
      '/v1/projects/{projectId}/instances/{instanceId}',
      "'v1','projects',projectId,'instances',instanceId",
    ],
    [
      '/v1/projects/{projectId}/instances/{instanceId}/databases/{databaseId}',
      "'v1','projects',projectId,'instances',instanceId,'databases',databaseId",
    ],
    [
      '/v1/projects/{projectId}/topics/{topicId}',
      "'v1','projects',projectId,'topics',topicId",
    ],
    [
      '/v1/projects/{projectId}/subscriptions/{subscriptionId}',
      "'v1','projects',projectId,'subscriptions',subscriptionId",
    ],
    [
      '/v1/projects/{projectId}/locations/{locationId}/functions/{functionId}',
      "'v1','projects',projectId,'locations',locationId,'functions',functionId",
    ],
    [
      '/v1/projects/{projectId}/locations/{locationId}/clusters/{clusterId}',
      "'v1','projects',projectId,'locations',locationId,'clusters',clusterId",
    ],
    [
      '/v1/projects/{projectId}/locations/{locationId}/registries/{registryId}',
      "'v1','projects',projectId,'locations',locationId,'registries',registryId",
    ],
    [
      '/v1/projects/{projectId}/locations/{locationId}/jobs/{jobId}',
      "'v1','projects',projectId,'locations',locationId,'jobs',jobId",
    ],
    [
      '/v1/projects/{projectId}/locations/{locationId}/queues/{queueId}/tasks/{taskId}',
      "'v1','projects',projectId,'locations',locationId,'queues',queueId,'tasks',taskId",
    ],
    [
      '/v1/projects/{projectId}/serviceAccounts/{serviceAccountId}',
      "'v1','projects',projectId,'serviceAccounts',serviceAccountId",
    ],
    [
      '/v1/projects/{projectId}/serviceAccounts/{serviceAccountId}/keys/{keyId}',
      "'v1','projects',projectId,'serviceAccounts',serviceAccountId,'keys',keyId",
    ],
    [
      '/v1/projects/{projectId}/zones/{zone}/instances/{instance}',
      "'v1','projects',projectId,'zones',zone,'instances',instance",
    ],
    [
      '/v1/projects/{projectId}/zones/{zone}/instanceGroups/{groupName}',
      "'v1','projects',projectId,'zones',zone,'instanceGroups',groupName",
    ],
    [
      '/v1/projects/{projectId}/global/networks/{networkName}',
      "'v1','projects',projectId,'global','networks',networkName",
    ],
    [
      '/v1/projects/{projectId}/global/firewalls/{firewallName}',
      "'v1','projects',projectId,'global','firewalls',firewallName",
    ],
    [
      '/v1/projects/{projectId}/regions/{region}/subnetworks/{subnetworkName}',
      "'v1','projects',projectId,'regions',region,'subnetworks',subnetworkName",
    ],
    [
      '/v1/projects/{projectId}/locations/{locationId}/keyRings/{keyRingId}/cryptoKeys/{cryptoKeyId}',
      "'v1','projects',projectId,'locations',locationId,'keyRings',keyRingId,'cryptoKeys',cryptoKeyId",
    ],
  ])('cloud: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 15. Real-world: SaaS APIs (Stripe/Shopify/Twilio) — 40 cases
// ============================================================
describe('15. Real-world: SaaS APIs', () => {
  test.each([
    // Stripe
    [
      '/v1/customers/{customerId}/subscriptions/{subId}',
      "'v1','customers',customerId,'subscriptions',subId",
    ],
    ['/v1/invoices/{invoiceId}/lines', "'v1','invoices',invoiceId,'lines'"],
    [
      '/v1/payment_intents/{piId}/confirm',
      "'v1','payment_intents',piId,'confirm'",
    ],
    [
      '/v1/payment_intents/{piId}/capture',
      "'v1','payment_intents',piId,'capture'",
    ],
    [
      '/v1/payment_intents/{piId}/cancel',
      "'v1','payment_intents',piId,'cancel'",
    ],
    ['/v1/charges/{chargeId}/refunds', "'v1','charges',chargeId,'refunds'"],
    [
      '/v1/charges/{chargeId}/refunds/{refundId}',
      "'v1','charges',chargeId,'refunds',refundId",
    ],
    [
      '/v1/customers/{customerId}/sources/{sourceId}',
      "'v1','customers',customerId,'sources',sourceId",
    ],
    [
      '/v1/customers/{customerId}/tax_ids/{taxIdId}',
      "'v1','customers',customerId,'tax_ids',taxIdId",
    ],
    ['/v1/products/{productId}/prices', "'v1','products',productId,'prices'"],
    [
      '/v1/subscriptions/{subId}/items/{itemId}',
      "'v1','subscriptions',subId,'items',itemId",
    ],
    [
      '/v1/accounts/{accountId}/capabilities/{capabilityId}',
      "'v1','accounts',accountId,'capabilities',capabilityId",
    ],
    [
      '/v1/transfers/{transferId}/reversals',
      "'v1','transfers',transferId,'reversals'",
    ],
    // Shopify
    [
      '/admin/api/{version}/products/{productId}.json',
      "'admin','api',version,'products',productId,'.json'",
    ],
    [
      '/admin/api/{version}/orders/{orderId}/fulfillments',
      "'admin','api',version,'orders',orderId,'fulfillments'",
    ],
    [
      '/admin/api/{version}/products/{productId}/variants/{variantId}.json',
      "'admin','api',version,'products',productId,'variants',variantId,'.json'",
    ],
    [
      '/admin/api/{version}/products/{productId}/images/{imageId}.json',
      "'admin','api',version,'products',productId,'images',imageId,'.json'",
    ],
    [
      '/admin/api/{version}/orders/{orderId}/transactions.json',
      "'admin','api',version,'orders',orderId,'transactions.json'",
    ],
    [
      '/admin/api/{version}/customers/{customerId}/addresses/{addressId}.json',
      "'admin','api',version,'customers',customerId,'addresses',addressId,'.json'",
    ],
    [
      '/admin/api/{version}/collections/{collectionId}/products.json',
      "'admin','api',version,'collections',collectionId,'products.json'",
    ],
    [
      '/admin/api/{version}/blogs/{blogId}/articles/{articleId}.json',
      "'admin','api',version,'blogs',blogId,'articles',articleId,'.json'",
    ],
    // Twilio
    [
      '/Accounts/{accountSid}/Messages/{messageSid}.json',
      "'Accounts',accountSid,'Messages',messageSid,'.json'",
    ],
    [
      '/Accounts/{accountSid}/Calls/{callSid}.json',
      "'Accounts',accountSid,'Calls',callSid,'.json'",
    ],
    [
      '/Accounts/{accountSid}/Calls/{callSid}/Recordings.json',
      "'Accounts',accountSid,'Calls',callSid,'Recordings.json'",
    ],
    [
      '/Accounts/{accountSid}/IncomingPhoneNumbers/{phoneSid}.json',
      "'Accounts',accountSid,'IncomingPhoneNumbers',phoneSid,'.json'",
    ],
    [
      '/Accounts/{accountSid}/Queues/{queueSid}/Members/{callSid}.json',
      "'Accounts',accountSid,'Queues',queueSid,'Members',callSid,'.json'",
    ],
    // Docker Registry
    ['/v2/{name}/manifests/{reference}', "'v2',name,'manifests',reference"],
    ['/v2/{name}/blobs/{digest}', "'v2',name,'blobs',digest"],
    ['/v2/{name}/tags/list', "'v2',name,'tags','list'"],
    // Elasticsearch
    ['/api/{index}/_doc/{docId}', "'api',index,'_doc',docId"],
    ['/api/{index}/_search', "'api',index,'_search'"],
    ['/api/{index}/_mapping', "'api',index,'_mapping'"],
    ['/api/{index}/_settings', "'api',index,'_settings'"],
    ['/api/{index}/_bulk', "'api',index,'_bulk'"],
    ['/api/{index}/_count', "'api',index,'_count'"],
    ['/api/{index}/_analyze', "'api',index,'_analyze'"],
    ['/api/{index}/_refresh', "'api',index,'_refresh'"],
    ['/api/{index}/_flush', "'api',index,'_flush'"],
    ['/api/{index}/_alias/{aliasName}', "'api',index,'_alias',aliasName"],
    [
      '/api/_snapshot/{repository}/{snapshot}',
      "'api','_snapshot',repository,snapshot",
    ],
  ])('saas: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 16. Real-world: REST with file extensions + dashes (Issue-adjacent) — 40 cases
// ============================================================
describe('16. File extensions and dash combos (Issue #883 adjacent)', () => {
  test.each([
    [
      '/api/reports/{reportId}-summary.pdf',
      "'api','reports',reportId,'-summary.pdf'",
    ],
    ['/exports/{exportId}-data.csv', "'exports',exportId,'-data.csv'"],
    ['/reports/{reportId}-annual.xlsx', "'reports',reportId,'-annual.xlsx'"],
    [
      '/invoices/{invoiceId}-receipt.pdf',
      "'invoices',invoiceId,'-receipt.pdf'",
    ],
    [
      '/contracts/{contractId}-signed.pdf',
      "'contracts',contractId,'-signed.pdf'",
    ],
    ['/images/{imageId}-thumb.jpg', "'images',imageId,'-thumb.jpg'"],
    ['/images/{imageId}-large.png', "'images',imageId,'-large.png'"],
    ['/images/{imageId}-original.webp', "'images',imageId,'-original.webp'"],
    ['/avatars/{userId}-small.png', "'avatars',userId,'-small.png'"],
    ['/avatars/{userId}-medium.png', "'avatars',userId,'-medium.png'"],
    ['/avatars/{userId}-large.png', "'avatars',userId,'-large.png'"],
    ['/logos/{orgId}-square.svg', "'logos',orgId,'-square.svg'"],
    ['/logos/{orgId}-wide.svg', "'logos',orgId,'-wide.svg'"],
    ['/banners/{bannerId}-desktop.jpg', "'banners',bannerId,'-desktop.jpg'"],
    ['/banners/{bannerId}-mobile.jpg', "'banners',bannerId,'-mobile.jpg'"],
    ['/documents/{docId}-draft.docx', "'documents',docId,'-draft.docx'"],
    ['/documents/{docId}-final.docx', "'documents',docId,'-final.docx'"],
    ['/documents/{docId}-redacted.pdf', "'documents',docId,'-redacted.pdf'"],
    ['/schemas/{schemaId}-v2.json', "'schemas',schemaId,'-v2.json'"],
    ['/schemas/{schemaId}-latest.yaml', "'schemas',schemaId,'-latest.yaml'"],
    [
      '/configs/{configId}-production.yaml',
      "'configs',configId,'-production.yaml'",
    ],
    ['/configs/{configId}-staging.yaml', "'configs',configId,'-staging.yaml'"],
    [
      '/configs/{configId}-development.yaml',
      "'configs',configId,'-development.yaml'",
    ],
    ['/templates/{tplId}-email.html', "'templates',tplId,'-email.html'"],
    ['/templates/{tplId}-invoice.html', "'templates',tplId,'-invoice.html'"],
    [
      '/templates/{tplId}-notification.html',
      "'templates',tplId,'-notification.html'",
    ],
    ['/logs/{logId}-access.gz', "'logs',logId,'-access.gz'"],
    ['/logs/{logId}-error.gz', "'logs',logId,'-error.gz'"],
    ['/logs/{logId}-audit.gz', "'logs',logId,'-audit.gz'"],
    ['/backups/{backupId}-full.tar.gz', "'backups',backupId,'-full.tar.gz'"],
    [
      '/backups/{backupId}-incremental.tar.gz',
      "'backups',backupId,'-incremental.tar.gz'",
    ],
    ['/dumps/{dumpId}-schema.sql', "'dumps',dumpId,'-schema.sql'"],
    ['/dumps/{dumpId}-data.sql', "'dumps',dumpId,'-data.sql'"],
    ['/builds/{buildId}-debug.apk', "'builds',buildId,'-debug.apk'"],
    ['/builds/{buildId}-release.apk', "'builds',buildId,'-release.apk'"],
    ['/builds/{buildId}-debug.ipa', "'builds',buildId,'-debug.ipa'"],
    ['/builds/{buildId}-release.ipa', "'builds',buildId,'-release.ipa'"],
    ['/assets/{assetId}-compressed.js', "'assets',assetId,'-compressed.js'"],
    ['/assets/{assetId}-minified.css', "'assets',assetId,'-minified.css'"],
    ['/maps/{mapId}-satellite.geojson', "'maps',mapId,'-satellite.geojson'"],
  ])('file+dash: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 17. i18n / locale patterns — 30 cases
// ============================================================
describe('17. i18n and locale patterns', () => {
  test.each([
    ['/i18n/{locale}/messages', "'i18n',locale,'messages'"],
    ['/assets/i18n-{locale}.json', "'assets','i18n-',locale,'.json'"],
    ['/locales/{lang}-{region}.json', "'locales',lang,'-',region,'.json'"],
    ['/translations/{lang}/strings', "'translations',lang,'strings'"],
    [
      '/api/v1/locales/{locale}/resources',
      "'api','v1','locales',locale,'resources'",
    ],
    ['/content/{lang}-{country}/pages', "'content',lang,'-',country,'pages'"],
    [
      '/content/{lang}-{country}/posts/{postId}',
      "'content',lang,'-',country,'posts',postId",
    ],
    ['/site-{locale}/home', "'site-',locale,'home'"],
    ['/site-{locale}/about', "'site-',locale,'about'"],
    ['/site-{locale}/products', "'site-',locale,'products'"],
    ['/api/{locale}/catalog', "'api',locale,'catalog'"],
    ['/api/{locale}/search', "'api',locale,'search'"],
    [
      '/help/{locale}/articles/{articleId}',
      "'help',locale,'articles',articleId",
    ],
    ['/docs/{locale}/guides/{guideId}', "'docs',locale,'guides',guideId"],
    ['/legal/{locale}/terms', "'legal',locale,'terms'"],
    ['/legal/{locale}/privacy', "'legal',locale,'privacy'"],
    [
      '/messages/{lang}-{region}/bundle.js',
      "'messages',lang,'-',region,'bundle.js'",
    ],
    ['/fonts/{locale}-regular.woff2', "'fonts',locale,'-regular.woff2'"],
    ['/fonts/{locale}-bold.woff2', "'fonts',locale,'-bold.woff2'"],
    ['/voice/{lang}-{accent}/model', "'voice',lang,'-',accent,'model'"],
    ['/tts/{lang}-{voice}/synthesize', "'tts',lang,'-',voice,'synthesize'"],
    [
      '/dictionaries/{lang}-{dialect}.json',
      "'dictionaries',lang,'-',dialect,'.json'",
    ],
    ['/spellcheck/{lang}/check', "'spellcheck',lang,'check'"],
    ['/grammar/{lang}/analyze', "'grammar',lang,'analyze'"],
    ['/ocr/{lang}/recognize', "'ocr',lang,'recognize'"],
    [
      '/translate/{sourceLang}-{targetLang}',
      "'translate',sourceLang,'-',targetLang",
    ],
    [
      '/translate/{sourceLang}-{targetLang}/text',
      "'translate',sourceLang,'-',targetLang,'text'",
    ],
    [
      '/translate/{sourceLang}-{targetLang}/document',
      "'translate',sourceLang,'-',targetLang,'document'",
    ],
    ['/keyboards/{lang}-{layout}.json', "'keyboards',lang,'-',layout,'.json'"],
    ['/ime/{lang}-{method}/candidates', "'ime',lang,'-',method,'candidates'"],
  ])('i18n: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 18. Version and date patterns — 40 cases
// ============================================================
describe('18. Version and date patterns', () => {
  test.each([
    // Version patterns
    ['/api/v{apiVersion}/endpoints', "'api','v',apiVersion,'endpoints'"],
    ['/api/v{ver}/resources', "'api','v',ver,'resources'"],
    ['/api/v{major}.{minor}/docs', "'api','v',major,'.',minor,'docs'"],
    [
      '/api/v{major}.{minor}.{patch}/schema',
      "'api','v',major,'.',minor,'.',patch,'schema'",
    ],
    [
      '/releases/v{major}.{minor}.{patch}',
      "'releases','v',major,'.',minor,'.',patch",
    ],
    [
      '/releases/v{major}.{minor}.{patch}-rc{rc}',
      "'releases','v',major,'.',minor,'.',patch,'-rc',rc",
    ],
    ['/downloads/v{ver}-linux', "'downloads','v',ver,'-linux'"],
    ['/downloads/v{ver}-macos', "'downloads','v',ver,'-macos'"],
    ['/downloads/v{ver}-windows', "'downloads','v',ver,'-windows'"],
    ['/sdk/v{ver}/init', "'sdk','v',ver,'init'"],
    ['/sdk/v{ver}/config', "'sdk','v',ver,'config'"],
    ['/cli/v{ver}/install', "'cli','v',ver,'install'"],
    ['/plugins/v{ver}/register', "'plugins','v',ver,'register'"],
    ['/agents/v{ver}/connect', "'agents','v',ver,'connect'"],
    ['/firmware/v{ver}/update', "'firmware','v',ver,'update'"],
    // Date patterns
    ['/archive/{year}-{month}', "'archive',year,'-',month"],
    ['/archive/{year}-{month}-{day}', "'archive',year,'-',month,'-',day"],
    [
      '/reports/{year}-{quarter}/summary',
      "'reports',year,'-',quarter,'summary'",
    ],
    ['/reports/{year}-Q{quarter}', "'reports',year,'-Q',quarter"],
    ['/reports/{year}/{month}', "'reports',year,month"],
    ['/reports/{year}/{month}/{day}', "'reports',year,month,day"],
    [
      '/events/{year}-{month}-{day}/schedule',
      "'events',year,'-',month,'-',day,'schedule'",
    ],
    [
      '/logs/{year}-{month}-{day}/entries',
      "'logs',year,'-',month,'-',day,'entries'",
    ],
    [
      '/metrics/{year}-{month}/dashboard',
      "'metrics',year,'-',month,'dashboard'",
    ],
    ['/billing/{year}-{month}/invoice', "'billing',year,'-',month,'invoice'"],
    [
      '/snapshots/{year}-{month}-{day}T{hour}',
      "'snapshots',year,'-',month,'-',day,'T',hour",
    ],
    ['/backups/{date}-daily', "'backups',date,'-daily'"],
    ['/backups/{date}-weekly', "'backups',date,'-weekly'"],
    ['/backups/{date}-monthly', "'backups',date,'-monthly'"],
    ['/releases/{date}-hotfix', "'releases',date,'-hotfix'"],
    ['/releases/{date}-stable', "'releases',date,'-stable'"],
    ['/releases/{date}-canary', "'releases',date,'-canary'"],
    ['/changelog/{year}', "'changelog',year"],
    ['/changelog/{year}-{month}', "'changelog',year,'-',month"],
    ['/sprints/{year}-W{week}', "'sprints',year,'-W',week"],
    ['/sprints/{year}-W{week}/tasks', "'sprints',year,'-W',week,'tasks'"],
    ['/fiscal/{year}-FY', "'fiscal',year,'-FY'"],
    ['/fiscal/{year}-H{half}', "'fiscal',year,'-H',half"],
    ['/academic/{year}-{term}', "'academic',year,'-',term"],
    ['/schedule/{year}-{season}', "'schedule',year,'-',season"],
  ])('version/date: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 19. Programmatically generated: param-suffix combos — 200 cases
// ============================================================
describe('19. Programmatic: param with various suffixes', () => {
  const resources = [
    'user',
    'item',
    'order',
    'product',
    'invoice',
    'ticket',
    'event',
    'task',
    'file',
    'report',
    'image',
    'video',
    'audio',
    'doc',
    'sheet',
    'chart',
    'graph',
    'map',
    'feed',
    'stream',
  ];
  const suffixes = [
    '-detail',
    '-info',
    '-summary',
    '-preview',
    '-download',
    '-status',
    '-config',
    '-metadata',
    '-history',
    '-archive',
  ];

  const cases: [string, string][] = [];
  for (const res of resources) {
    for (const suf of suffixes) {
      const paramName = `${res}Id`;
      const input = `/api/${res}s/{${paramName}}${suf}`;
      const expected = `'api','${res}s',${paramName},'${suf}'`;
      cases.push([input, expected]);
    }
  }

  test.each(cases)('generated suffix: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 20. Programmatically generated: prefix-param combos — 100 cases
// ============================================================
describe('20. Programmatic: prefix with param', () => {
  const prefixes = [
    'app-',
    'svc-',
    'ns-',
    'env-',
    'db-',
    'cluster-',
    'region-',
    'zone-',
    'pool-',
    'queue-',
  ];
  const resources = [
    'users',
    'items',
    'orders',
    'products',
    'invoices',
    'tasks',
    'events',
    'files',
    'reports',
    'configs',
  ];

  const cases: [string, string][] = [];
  for (const prefix of prefixes) {
    for (const res of resources) {
      const paramName = 'id';
      const input = `/${prefix}{${paramName}}/${res}`;
      const expected = `'${prefix}',${paramName},'${res}'`;
      cases.push([input, expected]);
    }
  }

  test.each(cases)('generated prefix: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 21. Programmatically generated: multi-param segment combos — 100 cases
// ============================================================
describe('21. Programmatic: two params with various separators', () => {
  const separators = ['-', '.', '_', ':', ',', '+', 'x', '=', '~', '@'];
  const paramPairs = [
    ['first', 'last'],
    ['start', 'end'],
    ['min', 'max'],
    ['source', 'target'],
    ['left', 'right'],
    ['from', 'to'],
    ['key', 'value'],
    ['host', 'port'],
    ['lat', 'lng'],
    ['width', 'height'],
  ];

  const cases: [string, string][] = [];
  for (const sep of separators) {
    for (const [p1, p2] of paramPairs) {
      const input = `/api/{${p1}}${sep}{${p2}}`;
      const expected = `'api',${p1},'${sep}',${p2}`;
      cases.push([input, expected]);
    }
  }

  test.each(cases)('generated multi-param: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 22. Programmatically generated: nested resource paths — 100 cases
// ============================================================
describe('22. Programmatic: nested resource paths', () => {
  const parentResources = [
    'orgs',
    'teams',
    'projects',
    'accounts',
    'workspaces',
    'tenants',
    'groups',
    'departments',
    'companies',
    'divisions',
  ];
  const childResources = [
    'users',
    'members',
    'tasks',
    'items',
    'records',
    'files',
    'messages',
    'events',
    'logs',
    'configs',
  ];

  const cases: [string, string][] = [];
  for (const parent of parentResources) {
    for (const child of childResources) {
      const pParam = `${parent.slice(0, -1)}Id`;
      const cParam = `${child.slice(0, -1)}Id`;
      const input = `/${parent}/{${pParam}}/${child}/{${cParam}}`;
      const expected = `'${parent}',${pParam},'${child}',${cParam}`;
      cases.push([input, expected]);
    }
  }

  test.each(cases)('generated nested: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});

// ============================================================
// 23. Programmatically generated: prefix + param + suffix — 80 cases
// ============================================================
describe('23. Programmatic: prefix + param + suffix combos', () => {
  const prefixes = ['app-', 'svc-', 'ns-', 'env-', 'db-', 'v', 'pre-', 'x-'];
  const suffixes = [
    '-info',
    '-status',
    '-config',
    '-logs',
    '-health',
    '.json',
    '.xml',
    '.html',
    '-v2',
    '-latest',
  ];

  const cases: [string, string][] = [];
  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      const input = `/api/${prefix}{id}${suffix}`;
      const expected = `'api','${prefix}',id,'${suffix}'`;
      cases.push([input, expected]);
    }
  }

  test.each(cases)('generated prefix+suffix: %s → %s', (input, expected) => {
    expect(routeToArray(input)).toBe(expected);
  });
});
