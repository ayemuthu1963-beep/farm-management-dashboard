#!/usr/bin/env python3
"""Explicit real Docker test only: signed activation and exact-original restoration.

Never executes the deployment controller entry point. Every mutator is restricted
by exact disposable names, image, owner label and captured full IDs. Raw evidence
stays in a private task directory. Main agent/reviewer must approve before use.
"""
import copy,hashlib,importlib.util,ipaddress,json,os,re,shlex,shutil,stat,subprocess,sys,types,uuid
from pathlib import Path
from docker_inspect_evidence import Evidence,sha,stable
import run_production_controller_lifecycle_integration as lifecycle

PREFIX='mfms-controller-repair-test-20260909-restore'
LIVE=PREFIX+'-live'; RETAINED=PREFIX+'-original'; NET=PREFIX+'-net'
LABEL=lifecycle.LABEL; IMAGE=lifecycle.IMAGE; SUBNET=lifecycle.SUBNET; POOL=lifecycle.POOL; ADDRESS=lifecycle.ADDRESS
BASE_HELPER=Path('/home/muthu/.local/libexec/mfms-production-backend-rollback-record.py')
BASE_HASH='186aa7f44ff806956d6c7ddcc337e9ced63d744cd5f21e872d5d9a95f91791e1'
ROOT=Path(__file__).resolve().parents[1]
HELPER=ROOT/'scripts/production-backend-rollback-record.py'
CONTROLLER=ROOT/'scripts/production-server-backend-deploy.sh'
IDENTITY='900000-20260909T190000Z-'+'a'*16
AUDIT=None
PRIVATE_ROOT=None
BEFORE=None

def require(ok,message):
 if not ok:raise RuntimeError(message)
def call(*args,check=True):
 result=subprocess.run(['docker',*args],capture_output=True,text=True,timeout=60)
 if AUDIT is not None and 'inspect' in args[:2]:AUDIT.inspection(result.stdout)
 if PRIVATE_ROOT is not None and 'inspect' in args[:2]:
  descriptor=os.open(PRIVATE_ROOT/('adapter-inspect-'+uuid.uuid4().hex+'.raw.json'),os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(descriptor,'w') as handle:handle.write(result.stdout);handle.flush();os.fsync(handle.fileno())
 if check:require(result.returncode==0,'disposable Docker command failed: '+args[0])
 return result

def inspect(identity):return json.loads(call('inspect',identity).stdout)[0]
def load_module(path,name):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def load_legacy(path):
 path=Path(path)
 require(path.is_absolute() and not path.is_symlink(),'unsafe legacy helper path')
 for directory in path.parents:
  info=directory.lstat()
  require(stat.S_ISDIR(info.st_mode) and not directory.is_symlink() and info.st_uid in (0,os.getuid()) and not info.st_mode & 0o022,'unsafe legacy helper ancestor')
 info=path.lstat()
 require(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and info.st_uid in (0,os.getuid()) and not info.st_mode & 0o022,'unsafe legacy helper file')
 source=path.read_bytes()
 require(hashlib.sha256(source).hexdigest()==BASE_HASH,'legacy helper bytes changed')
 module=types.ModuleType('legacy_signed_records');module.__file__=str(path)
 sys.modules[module.__name__]=module
 exec(compile(source,str(path),'exec'),module.__dict__)
 return module

def owned(identity,meta):
 require(identity in meta['ids'],'unowned ID')
 item=inspect(identity)
 require(item['Id']==identity and item['Image']==IMAGE and item['Name'] in {'/'+LIVE,'/'+RETAINED},'disposable identity changed')
 require(item['Config']['Labels'].get(LABEL)==PREFIX and item['Config']['Labels'].get('com.muthufarms.mfms.environment')=='DisposableTest','disposable label changed')
 require(item['Config']['Entrypoint']==['python'] and item['Config']['Cmd']==['-c','import time; time.sleep(900)'],'disposable command changed')
 host=item['HostConfig']
 require(not item['Mounts'] and not host.get('Mounts') and not host.get('Binds') and not host.get('PortBindings'),'forbidden test mounts/ports')
 require(host['NetworkMode']==meta['network'] and host['RestartPolicy']['Name']=='no' and not host.get('Privileged') and not host.get('PublishAllPorts') and not host.get('Devices') and not host.get('DeviceRequests') and not host.get('CapAdd'),'unsafe test runtime')
 require(host.get('PidMode','')=='' and host.get('IpcMode')=='private' and host.get('UTSMode','')=='','unsafe test namespace')
 require(set(item['NetworkSettings']['Networks']) <= {NET},'unowned test network')
 return item

def owned_network(meta):
 network=json.loads(call('network','inspect',meta['network']).stdout)[0]
 require(network['Id']==meta['network'] and network['Name']==NET and network['Internal'] and network['Driver']=='bridge' and network['Labels'].get(LABEL)==PREFIX,'network ownership changed')
 require(network['IPAM']['Config']==[{'Subnet':SUBNET,'IPRange':POOL,'Gateway':'172.30.240.1'}],'network configuration changed')
 require(set(network['Containers']) <= set(meta['ids']),'unowned network member')
 return network

def resource(value,meta):
 require(value in meta['ids'] or value in (LIVE,RETAINED),'unowned resource argument')
 item=inspect(value);owned(item['Id'],meta);return item['Id']

def metadata(path):
 global PRIVATE_ROOT
 path=Path(path)
 require(path.name=='adapter.json' and path.parent.name.startswith('lifecycle-'),'invalid adapter path')
 for directory in [path.parent,*path.parent.parents]:
  info=directory.lstat()
  require(stat.S_ISDIR(info.st_mode) and not directory.is_symlink() and info.st_uid in (0,os.getuid()) and not info.st_mode & 0o022,'unsafe adapter ancestor')
 info=path.lstat()
 require(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and info.st_uid==os.getuid() and stat.S_IMODE(info.st_mode)==0o600 and not path.is_symlink(),'unsafe adapter metadata')
 require(stat.S_IMODE(path.parent.stat().st_mode)==0o700 and path.parent.stat().st_uid==os.getuid(),'unsafe adapter directory')
 meta=json.loads(path.read_text());require(meta['prefix']==PREFIX and re.fullmatch('[0-9a-f]{64}',meta['network']),'adapter identity')
 require(all(re.fullmatch('[0-9a-f]{64}',v) for v in meta['ids']) and len(meta['ids'])==2 and len(set(meta['ids']))==2,'adapter ID set')
 require(meta['original'] in meta['ids'] and meta['candidate'] in meta['ids'] and meta['original']!=meta['candidate'],'adapter role IDs')
 PRIVATE_ROOT=path.parent
 return meta

def docker_adapter(path,args):
 meta=metadata(path);require(args,'empty adapter command');operation=args[0]
 if operation=='inspect' or args[:2]==['container','inspect']:
  resource(args[-1],meta)
  require(args[:2]==['container','inspect'] and len(args)==3 or operation=='inspect' and (len(args)==2 or len(args)==4 and args[1]=='--format'),'inspect grammar')
 elif args[:2]==['network','inspect']:
  require(args[-1] in (NET,meta['network']),'network inspect target');owned_network(meta)
  require(len(args)==3 or len(args)==5 and args[2]=='--format','network inspect grammar')
 elif operation in ('start','stop'):
  require(len(args)==2 or operation=='stop' and len(args)==4 and args[1:3]==['--time','30'],'start/stop grammar');resource(args[-1],meta)
 elif operation=='rm':
  require(len(args)==3 and args[1]=='-f','remove grammar');require(resource(args[-1],meta)==meta['candidate'],'original removal forbidden')
 elif operation=='rename':
  require(len(args)==3 and args[2] in (LIVE,RETAINED),'rename grammar');resource(args[1],meta)
 elif args[:2]==['network','disconnect']:
  require(len(args)==5 and args[2]=='--force' and args[3]==NET,'disconnect grammar');resource(args[4],meta);owned_network(meta)
 elif args[:2]==['network','connect']:
  require(len(args)==6 and args[2:5]==['--ip',ADDRESS,NET],'connect grammar');resource(args[5],meta);owned_network(meta)
 else:raise RuntimeError('operation outside disposable adapter surface')
 if operation not in ('inspect','container') and args[:2]!=['network','inspect']:
  log=Path(path).parent/'mutations.jsonl'
  descriptor=os.open(log,os.O_WRONLY|os.O_CREAT|os.O_APPEND|os.O_NOFOLLOW,0o600)
  info=os.fstat(descriptor)
  require(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and info.st_uid==os.getuid() and stat.S_IMODE(info.st_mode)==0o600,'unsafe mutation evidence')
  with os.fdopen(descriptor,'w',encoding='utf-8') as handle:handle.write(json.dumps(args)+'\n');handle.flush();os.fsync(handle.fileno())
 result=call(*args,check=False);sys.stdout.write(result.stdout);return result.returncode

def projected_item(module,raw):
 item=copy.deepcopy(raw)
 # Only isolation/Production contract identities are adapted. OOM field and all
 # other HostConfig fields are the unmodified real daemon inspection values.
 item['Config']['Env']=['MFMS_ENV=production','MFMS_TARGET_DATABASE=mfms_server_prod','DATABASE_URL=postgresql://synthetic.invalid/mfms_server_prod','MFMS_GIT_COMMIT='+lifecycle.REVISION]
 item['HostConfig']['NetworkMode']='harvest-net'
 item['HostConfig']['PortBindings']={'8000/tcp':[{'HostIp':'127.0.0.1','HostPort':'8001'}]}
 item['HostConfig']['RestartPolicy']={'Name':'unless-stopped','MaximumRetryCount':0}
 item['Mounts']=[dict(Type=t,Source=s,Destination=d,RW=rw) for t,s,d,rw in module.BASE_MOUNTS]
 endpoints=item['NetworkSettings']['Networks'];mapped={}
 if NET in endpoints:
  endpoint=copy.deepcopy(endpoints[NET]);require(endpoint['IPAddress'] in ('',ADDRESS),'test IP drift')
  endpoint['IPAddress']='172.19.0.2' if endpoint['IPAddress'] else ''
  require(endpoint['IPAMConfig']['IPv4Address']==ADDRESS,'test static IP drift');endpoint['IPAMConfig']['IPv4Address']='172.19.0.2'
  require(not endpoint.get('Aliases'),'unexpected test aliases');mapped['harvest-net']=endpoint
 item['NetworkSettings']['Networks']=mapped
 return item

def projected_artifact(module,name,meta):
 require(name in ('harvest-api','harvest-api-pre-disposable'),'unexpected logical helper name')
 actual=LIVE if name=='harvest-api' else RETAINED
 item=projected_item(module,owned(resource(actual,meta),meta));network=owned_network(meta)
 owner_items={}
 for identity,owner in network['Containers'].items():
  require(identity in meta['ids'] and owner['IPv4Address']==ADDRESS+'/24','unexpected raw endpoint owner address')
  owner_items[identity]=projected_item(module,owned(identity,meta))
  owner['IPv4Address']='172.19.0.2/16'
 network['Name']='harvest-net';network['IPAM']['Config']=[{'Subnet':'172.19.0.0/16','IPRange':'172.19.128.0/17','Gateway':'172.19.0.1'}]
 image=json.loads(call('image','inspect',IMAGE).stdout)[0]
 return item,image,network,owner_items

def projected_snapshot(module,name,meta):
 item,image,network,owner_items=projected_artifact(module,name,meta)
 # The unmodified checksum-pinned legacy module predates owner_items. The
 # repaired helper must execute its real owner validation using raw lifecycle
 # inspections, never an adapter-generated successful readiness result.
 if module.__name__=='legacy_signed_records':return module.snapshot(item,image,network)
 return module.snapshot(item,image,network,owner_items=owner_items)

def records(module,directory,meta):return module.Records(directory,inspect=lambda name:projected_snapshot(module,name,meta))
def record_adapter(path,args):
 meta=metadata(path);module=load_module(HELPER,'repaired_records_adapter');r=records(module,Path(path).parent/'failed-state',meta)
 require(args,'empty record operation')
 logical=lambda name: 'harvest-api' if name==LIVE else 'harvest-api-pre-disposable' if name==RETAINED else None
 if args[0]=='network-state':
  require(len(args)==3 and logical(args[1]) and args[2] in ('attached','running','ip','static_ip'),'invalid network-state arguments')
  item,image,network,owner_items=projected_artifact(module,logical(args[1]),meta)
  module.snapshot(item,image,network,owner_items=owner_items)
  value=module.network_state(item,network,owner_items=owner_items)[args[2]]
  # Translate only validated synthetic address back to the disposable subnet.
  if value=='172.19.0.2':value=ADDRESS
  print(str(value).lower() if type(value) is bool else value)
 elif args[0] in ('restore-ready','replacement-ready'):
  require(len(args)==4 and args[1]==IDENTITY and args[2]=='deploy' and logical(args[3]),'invalid readiness arguments')
  method=r.restore_ready if args[0]=='restore-ready' else r.replacement_ready
  method(IDENTITY,'deploy',logical(args[3]))
 elif args[0]=='transition-ready':
  require(len(args)==6 and args[1]==IDENTITY and args[2]=='deploy' and args[3] in ('source','target') and logical(args[4]) and args[5] in ('true','false'),'invalid transition readiness arguments')
  r.transition_ready(IDENTITY,'deploy',args[3],logical(args[4]),args[5])
 elif args[0]=='restored':
  require(args==['restored',IDENTITY,'deploy'],'invalid restored arguments');r.restored(IDENTITY,'deploy')
 elif args==['contract']:
  module.Records.match(projected_snapshot(module,'harvest-api',meta),r.load(IDENTITY,'prepare')['previous'],running=True)
 else:raise RuntimeError('invalid record adapter operation')

def extract(name):
 source=CONTROLLER.read_text();match=re.search(r'^'+re.escape(name)+r'\(\) \{.*?^\}',source,re.M|re.S)
 require(match is not None,'missing reviewed shell function '+name);return match.group()

def run_restore(meta_path):
 meta=metadata(meta_path);root=meta_path.parent
 funcs=['container_exists','container_running','network_ip_for_container','network_attached_for_container','network_static_ip_for_container','assert_transition_ownership','stop_backend_for_transition','start_backend_for_transition','disconnect_production_network','ensure_production_network_ip','restore_original_backend']
 prefix='set -Eeuo pipefail\n'
 variables=dict(backend_live_container=LIVE,production_network=NET,approved_production_ipv4=ADDRESS,original_container_id=meta['original'],transaction_backup=RETAINED,replacement_origin='',timestamp='20260909T190000Z',previous_state=str(root/'previous-state'),state_dir=str(root/'failed-state'),state_file=str(root/'failed-state/last-successful-backend-switch'),operation='deploy',original_revision=lifecycle.REVISION,original_image_id=IMAGE,original_network_ip=ADDRESS,deployment_id=IDENTITY)
 prefix+='\n'.join(k+'='+shlex.quote(v) for k,v in variables.items())+'\n'
 invocation=shlex.quote(sys.executable)+' '+shlex.quote(str(Path(__file__).resolve()))
 prefix+='docker() { '+invocation+' --adapter '+shlex.quote(str(meta_path))+' "$@"; }\n'
 prefix+='rollback_record() { '+invocation+' --record '+shlex.quote(str(meta_path))+' "$@"; }\n'
 prefix+='assert_live_contract() { '+invocation+' --record '+shlex.quote(str(meta_path))+' contract; }\n'
 prefix+='blocked() { return 1; }\n'
 script=prefix+'\n'.join(extract(f) for f in funcs)+'\nrestore_original_backend\n[[ "$automatic_restore_result" == pass ]]\n'
 result=subprocess.run(['bash','--noprofile','--norc'],input=script,text=True,capture_output=True,timeout=180)
 AUDIT.write('restore-shell-result-'+str(len(list(root.glob('restore-shell-result-*'))))+'.json',{'returncode':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
 require(result.returncode==0,'extracted restoration failed; inspect private evidence')

def create(meta):
 identity=call('create','--pull','never','--name',LIVE,'--label',LABEL+'='+PREFIX,
  '--label','com.muthufarms.mfms.environment=DisposableTest','--network',meta['network'],
  '--ip',ADDRESS,'--restart','no','--memory','128m','--pids-limit','32','--cpus','0.25',
  '--entrypoint','python',IMAGE,'-c','import time; time.sleep(900)').stdout.strip()
 require(re.fullmatch('[0-9a-f]{64}',identity),'noncanonical created ID')
 meta['ids'].append(identity);owned(identity,meta);return identity

def immutable_hashes(directory):
 return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (directory/'backend-rollback-records').iterdir()}

def main():
 global AUDIT,BEFORE
 require(len(sys.argv)==1 or len(sys.argv)==3 and sys.argv[1]=='--legacy-helper','unexpected harness arguments')
 legacy=BASE_HELPER if len(sys.argv)==1 else Path(sys.argv[2])
 old=load_legacy(legacy);new=load_module(HELPER,'repaired_signed_records')
 AUDIT=Evidence(Path.home()/'.local/state/mfms-controller-repair-tests')
 lifecycle.AUDIT=AUDIT
 before=lifecycle.inventory();BEFORE=before;AUDIT.snapshot('restore-before',before);lifecycle.production_health()
 require(not any(v['Name'] in ('/'+LIVE,'/'+RETAINED) for v in before.values()),'test names already exist')
 image=json.loads(call('image','inspect',IMAGE).stdout)[0]
 require(image['Id']==IMAGE and not image['Config'].get('Volumes'),'unexpected image volumes')
 allowed_env={'PATH','LANG','GPG_KEY','PYTHON_VERSION','PYTHON_SHA256','PYTHONDONTWRITEBYTECODE','PYTHONUNBUFFERED','MFMS_GIT_COMMIT','MFMS_BUILD_TIMESTAMP','MFMS_BUILD_ENVIRONMENT','MFMS_FERTILISER_WRITES_ENABLED'}
 require(all(v.split('=',1)[0] in allowed_env for v in image['Config'].get('Env') or []),'unexpected inherited environment')
 for line in call('network','ls','--format','json').stdout.splitlines():
  value=json.loads(line);require(value['Name']!=NET,'test network already exists')
  network=json.loads(call('network','inspect',value['ID']).stdout)[0]
  for item in network.get('IPAM',{}).get('Config') or []:
   if item.get('Subnet') and ipaddress.ip_network(item['Subnet']).version==4:
    require(not ipaddress.ip_network(SUBNET).overlaps(ipaddress.ip_network(item['Subnet'])),'subnet overlap')
 meta={'prefix':PREFIX,'ids':[]};network_attempted=False;create_attempted=False;complete=False
 try:
  network_attempted=True
  meta['network']=call('network','create','--internal','--driver','bridge','--subnet',SUBNET,'--ip-range',POOL,'--gateway','172.30.240.1','--label',LABEL+'='+PREFIX,NET).stdout.strip()
  owned_network(meta)
  create_attempted=True;meta['original']=create(meta)
  call('start',meta['original']);original=owned(meta['original'],meta);AUDIT.snapshot('original-running',{meta['original']:original})
  directory=AUDIT.root/'failed-state';directory.mkdir(mode=0o700)
  r=records(old,directory,meta);r.initialize()
  state={'deployed_revision':lifecycle.REVISION,'deployed_image_id':IMAGE,'deployed_image_tag':'disposable-current','rollback_container':'harvest-api-pre-disposable','rollback_revision':lifecycle.REVISION,'rollback_image_id':IMAGE,'rollback_image_tag':'disposable-previous','run_id':'899999','updated_at':'20260909T185900Z','database_migrations':'forward-only'}
  old.atomic_write(r.state_path,old.state_bytes(state))
  source_state=r.state_path.read_bytes();AUDIT.write('previous-state',source_state,raw=True)
  r.stage(IDENTITY,lifecycle.REVISION,IMAGE,'harvest-api-pre-disposable','900000','20260909T190000Z')
  call('stop','--time','30',meta['original']);owned(meta['original'],meta);owned_network(meta)
  call('network','disconnect','--force',NET,meta['original']);call('rename',meta['original'],RETAINED)
  meta['candidate']=create(meta);AUDIT.snapshot('candidate-created',{meta['candidate']:owned(meta['candidate'],meta)})
  r.finalize(IDENTITY,'disposable-candidate','disposable-original')
  signed_before=immutable_hashes(directory)
  created=owned(meta['candidate'],meta)
  call('start',meta['candidate']);running=owned(meta['candidate'],meta);AUDIT.snapshot('candidate-running',{meta['candidate']:running})
  require(created['HostConfig']['OomKillDisable'] is False and running['HostConfig']['OomKillDisable'] is None,'expected Docker lifecycle transition not reproduced')
  expected_refusal=False
  try:r.activate(IDENTITY)
  except old.Refused as error:
   require(str(error)=='container/image/environment/configuration drift','unexpected legacy failure')
   expected_refusal=True
  require(expected_refusal and r.state_path.read_bytes()==source_state,'legacy activation did not refuse safely')
  copy_dir=AUDIT.root/'repaired-activation-state';shutil.copytree(directory,copy_dir)
  repaired=records(new,copy_dir,meta);repaired.activate(IDENTITY)
  require(repaired.state()[0]['rollback_record_id']==IDENTITY,'repaired activation not committed')
  require(immutable_hashes(directory)==signed_before==immutable_hashes(copy_dir),'signed records were changed')
  AUDIT.write('adapter.json',meta);meta_path=AUDIT.root/'adapter.json'
  run_restore(meta_path)
  restored=owned(meta['original'],meta);require(restored['State']['Running'] and restored['Name']=='/'+LIVE,'original not running')
  require(all(restored[k]==original[k] for k in ('Id','Image','Config','HostConfig','Mounts')),'original artifact/configuration changed')
  require(r.state_path.read_bytes()==source_state and immutable_hashes(directory)==signed_before,'prior signed state not restored exactly')
  first_start=restored['State']['StartedAt'];run_restore(meta_path)
  require(owned(meta['original'],meta)['State']['StartedAt']==first_start,'repeated restore restarted original')
  AUDIT.snapshot('original-restored',{meta['original']:owned(meta['original'],meta)})
  AUDIT.write('signed-regression.json',{'legacy_expected_activation_refusal':True,'repaired_activation_pass':True,'actual_restore_pass':True,'repeat_restore_same_started_at':True,'signed_bytes_unchanged':True,'legacy_helper_sha256':BASE_HASH,'repaired_helper_sha256':hashlib.sha256(HELPER.read_bytes()).hexdigest(),'controller_sha256':hashlib.sha256(CONTROLLER.read_bytes()).hexdigest(),'original_id':meta['original'],'candidate_id':meta['candidate'],'source_state_sha256':hashlib.sha256(source_state).hexdigest()})
  complete=True
 except BaseException as error:
  AUDIT.failure('restore-phase-failure',error)
  raise
 finally:
  # Reconcile successful daemon mutations even if a CLI reply was lost. Only
  # exact absent-before names with this owner label and immutable image qualify.
  present=lifecycle.inventory()
  for item in present.values():
   if item['Name'] in ('/'+LIVE,'/'+RETAINED):
    require(item['Id'] not in before and item['Image']==IMAGE and item['Config']['Labels'].get(LABEL)==PREFIX,'cleanup ownership mismatch')
    if item['Id'] not in meta['ids']:meta['ids'].append(item['Id'])
  if network_attempted and 'network' not in meta:
   found=[json.loads(v) for v in call('network','ls','--format','json').stdout.splitlines() if json.loads(v)['Name']==NET]
   if found:meta['network']=json.loads(call('network','inspect',found[0]['ID']).stdout)[0]['Id']
  if 'network' in meta:
   for identity in list(meta['ids']):
    if identity in present:owned(identity,meta);call('rm','-f',identity)
   net=owned_network(meta);require(not net['Containers'],'test network still occupied');call('network','rm',meta['network'])
  after=lifecycle.inventory();AUDIT.snapshot('restore-after',after)
  summary=AUDIT.comparison(before,after,'restore-protected-comparison')
  require(summary['protected_changes']==0 and summary['before_sha256']==summary['after_sha256'],'protected inventory drift')
  lifecycle.production_health()
 require(complete,'incomplete signed restoration test')
 print('PRIVATE_RESTORE_EVIDENCE_DIRECTORY='+str(AUDIT.root))
 print('SIGNED_ACTIVATION_AND_RESTORE_STATUS=PASS')

if __name__=='__main__':
 try:
  if len(sys.argv)>2 and sys.argv[1]=='--adapter':raise SystemExit(docker_adapter(Path(sys.argv[2]),sys.argv[3:]))
  elif len(sys.argv)>2 and sys.argv[1]=='--record':record_adapter(Path(sys.argv[2]),sys.argv[3:])
  else:main()
 except BaseException as error:
  if isinstance(error,SystemExit) and error.code==0:raise
  if AUDIT is not None:
   try:AUDIT.failure('restore-final-failure',error)
   except BaseException:pass
   try:
    failed=lifecycle.inventory();AUDIT.snapshot('restore-failure',failed)
    if BEFORE is not None:AUDIT.comparison(BEFORE,failed,'restore-failure-comparison')
   except BaseException as closure_error:
    try:AUDIT.failure('restore-closure-failure',closure_error)
    except BaseException:pass
   print('PRIVATE_RESTORE_EVIDENCE_DIRECTORY='+str(AUDIT.root))
  print('SIGNED_ACTIVATION_AND_RESTORE_STATUS=FAILED',file=sys.stderr)
  raise SystemExit(1) from None
