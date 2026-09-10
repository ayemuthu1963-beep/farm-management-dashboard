"""Independent hermetic adapter and pre-mutation signed-recovery rejection tests."""
import copy,importlib.util,json,os,subprocess,sys,unittest
from pathlib import Path
from unittest.mock import Mock,patch
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import run_production_controller_restore_integration as h
import test_production_backend_rollback_record as t
import test_production_backend_network_state as n

class AdapterBoundary(unittest.TestCase):
 def setUp(self):
  self.meta={'prefix':h.PREFIX,'ids':['a'*64,'b'*64],'original':'a'*64,'candidate':'b'*64,'network':'c'*64}
  self.item={'Id':'a'*64,'Image':h.IMAGE,'Name':'/'+h.LIVE,'Config':{'Labels':{h.LABEL:h.PREFIX,'com.muthufarms.mfms.environment':'DisposableTest'},'Entrypoint':['python'],'Cmd':['-c','import time; time.sleep(900)']},'Mounts':[],
   'HostConfig':{'NetworkMode':'c'*64,'RestartPolicy':{'Name':'no'},'IpcMode':'private'},'NetworkSettings':{'Networks':{h.NET:{}}}}
 def reject(self,args,item=None):
  with patch.object(h,'metadata',return_value=self.meta),patch.object(h,'inspect',return_value=item or self.item),patch.object(h,'owned_network'),patch.object(h,'call') as docker:
   with self.assertRaises(RuntimeError):h.docker_adapter(Path('unopened-adapter.json'),args)
   docker.assert_not_called()
 def test_forbidden_command_and_production_targets_reject_without_docker(self):
  cases=[['build','.'],['pull',h.IMAGE],['exec',h.LIVE,'python','-c','write'],['run',h.IMAGE],['start','harvest-api'],['start','harvest-api-pilot'],['start','d'*64],['rm','-f',h.LIVE],['rename',h.LIVE,'harvest-api'],['network','connect','--ip',h.ADDRESS,'harvest-net',h.LIVE],['network','disconnect','--force','harvest-net',h.LIVE],['network','rm',h.NET],['volume','rm','x'],['stop','--time','0',h.LIVE],['inspect','--format','{{.Id}}','harvest-api'],['network','inspect','harvest-net'],['start',h.LIVE,'extra']]
  for args in cases:
   with self.subTest(operation=args[0]):self.reject(args)
 def test_wrong_image_labels_mounts_ports_or_namespace_reject_without_mutation(self):
  changes=[lambda x:x.update(Image='sha256:'+'e'*64),lambda x:x.update(Id='d'*64),lambda x:x['Config']['Labels'].update({h.LABEL:'wrong'}),lambda x:x['Config']['Labels'].update({'com.muthufarms.mfms.environment':'Production'}),lambda x:x['Mounts'].append({'Source':'/production'}),lambda x:x['HostConfig'].update(PortBindings={'8000/tcp':[]}),lambda x:x['HostConfig'].update(Privileged=True),lambda x:x['HostConfig'].update(PidMode='host'),lambda x:x['HostConfig'].update(NetworkMode='harvest-net'),lambda x:x['Config'].update(Cmd=['start-app'])]
  for change in changes:
   value=copy.deepcopy(self.item);change(value)
   with self.subTest(change=repr(change)):self.reject(['start',h.LIVE],value)

 def test_protected_closure_allows_only_transient_exec_ids(self):
  self.assertTrue(h.protected_closure(
   {'protected_changes':0,'original_projection_canonical_changes':0},{'protected':[]}))
  transient={'path':['a'*64,'ExecIDs'],'change':'type','before':['b'*64],'after':None}
  self.assertTrue(h.protected_closure(
   {'protected_changes':1,'original_projection_canonical_changes':0},{'protected':[transient]}))
  for summary,changes in [
   ({'protected_changes':1,'original_projection_canonical_changes':1},[transient]),
   ({'protected_changes':2,'original_projection_canonical_changes':0},[transient]),
   ({'protected_changes':1,'original_projection_canonical_changes':0},[dict(transient,path=['a'*64,'State','Running'])]),
   ({'protected_changes':1,'original_projection_canonical_changes':0},[dict(transient,path=['ExecIDs'])]),
  ]:
   with self.subTest(summary=summary,changes=changes):
    self.assertFalse(h.protected_closure(summary,{'protected':changes}))

class SignedBeforeMutation(unittest.TestCase):
 def test_bad_signature_configuration_state_and_owner_stop_actual_restore_before_mutation(self):
  for case in ('signature','configuration','state','owner'):
   with self.subTest(case=case):
    fixture=t.RecordTests();fixture.setUp()
    try:
     fixture.records.stage(t.FUTURE_ID,t.FUTURE,'sha256:'+'3'*64,t.FUTURE_TARGET,'1000','20260909T100000Z')
     if case=='signature':
      path=fixture.records.path(t.FUTURE_ID,'prepare');envelope=json.loads(path.read_text());envelope['signature']='0'*64;path.chmod(0o600);path.write_text(json.dumps(envelope));path.chmod(0o400)
     elif case=='configuration':fixture.live[0]['HostConfig']['Memory']=42
     elif case=='state':t.MODULE.atomic_write(fixture.records.state_path,t.MODULE.state_bytes(dict(fixture.state,deployed_revision='a'*40)))
     else:
      real=fixture.records.inspect
      fixture.records.inspect=lambda name:dict(real(name),production_address_owners=['f'*64])
     with self.assertRaises(t.MODULE.Refused):fixture.records.restore_ready(t.FUTURE_ID,'deploy','harvest-api')
     # Feed that real failed signed gate into the exact controller function and
     # prove no later stop/connect/rename/start command can run.
     script='''set -euo pipefail
backend_live_container=fixture-live
transaction_backup=''
original_container_id='''+fixture.live[0]['Id']+'''
deployment_id=fixture-deployment
operation=deploy
container_exists() { [[ "$1" == fixture-live ]]; }
docker() { if [[ "$1" == inspect && "$2" == --format && "$3" == '{{.Id}}' ]]; then echo "$original_container_id"; else echo MUTATION; return 99; fi; }
rollback_record() { [[ "$1" == restore-ready ]] || { echo UNEXPECTED_GATE; return 99; }; return 1; }
'''+h.extract('restore_original_backend')+'\nrestore_original_backend || exit 7\necho UNSAFE_PASS\n'
     bash='C:/Program Files/Git/bin/bash.exe' if os.name=='nt' else 'bash'
     result=subprocess.run([bash,'--noprofile','--norc'],input=script,text=True,capture_output=True)
     self.assertEqual(result.returncode,7,result.stdout+result.stderr);self.assertNotIn('MUTATION',result.stdout);self.assertNotIn('UNSAFE_PASS',result.stdout)
    finally:fixture.tearDown()

class OwnerTransitionBoundary(unittest.TestCase):
 def test_actual_owner_proof_rejects_duplicate_stale_or_changed_lifecycle(self):
  subject,network=n.fixture()
  owner=copy.deepcopy(subject);owner['Id']='c'*64;owner['State']['Running']=True
  owner['NetworkSettings']['Networks']['harvest-net'].update(NetworkID=network['Id'],EndpointID='d'*64,IPAddress='172.19.0.2')
  network['Containers'][owner['Id']]={'IPv4Address':'172.19.0.2/16','EndpointID':'d'*64}
  self.assertFalse(t.MODULE.network_state(subject,network,check_conflicts=False,owner_items={owner['Id']:owner})['running'])
  mutations=[lambda x:x['State'].update(Running=False),lambda x:x['State'].update(Paused=True),lambda x:x['State'].update(Restarting=True),lambda x:x['State'].update(Dead=True),lambda x:x['NetworkSettings']['Networks']['harvest-net'].update(EndpointID='e'*64),lambda x:x['NetworkSettings']['Networks']['harvest-net'].update(NetworkID='f'*64),lambda x:x['NetworkSettings']['Networks']['harvest-net'].update(IPAddress='172.19.0.3')]
  for mutate in mutations:
   changed=copy.deepcopy(owner);mutate(changed)
   with self.subTest(mutation=repr(mutate)),self.assertRaises(t.MODULE.Refused):
    t.MODULE.network_state(subject,network,check_conflicts=False,owner_items={owner['Id']:changed})
  duplicate=copy.deepcopy(network);duplicate['Containers']['e'*64]=copy.deepcopy(network['Containers'][owner['Id']])
  with self.assertRaises(t.MODULE.Refused):
   t.MODULE.network_state(subject,duplicate,check_conflicts=False,owner_items={owner['Id']:owner})
  with self.assertRaises(t.MODULE.Refused):
   t.MODULE.network_state(subject,network,check_conflicts=False,owner_items={})

 def test_transition_adapter_rejects_unpinned_arguments_without_gate_or_docker(self):
  base=['transition-ready',h.IDENTITY,'deploy','source',h.LIVE,'false']
  invalid=[(1,'other-deployment'),(2,'rollback'),(3,'other-role'),(4,'harvest-api'),(4,'harvest-api-pilot'),(4,'f'*64),(5,'False'),(5,'0')]
  for index,value in invalid:
   args=base.copy();args[index]=value
   with self.subTest(index=index,value=value),patch.object(h,'metadata',return_value={'state_name':'prepare-only-state'}),patch.object(h,'load_module'),patch.object(h,'records') as records,patch.object(h,'call') as docker:
    with self.assertRaises(RuntimeError):h.record_adapter(Path('unopened-adapter.json'),args)
    records.return_value.transition_ready.assert_not_called();docker.assert_not_called()

 def test_owner_drift_before_or_after_each_actual_transition_stops_chain(self):
  # Only child Bash is real; every Docker/readiness command is a local function.
  # Failure at the second signed check models an owner race during a mutation.
  cases=[('start_backend_for_transition','fixture source','false','false'),
         ('stop_backend_for_transition','fixture target','true','true'),
         ('disconnect_production_network','fixture target','false','true'),
         ('ensure_production_network_ip','fixture 172.19.0.2 source','false','false')]
  for name,args,running,attached in cases:
   for failure_check in (1,2):
    with self.subTest(function=name,failure_check=failure_check):
     prelude='''set -euo pipefail
deployment_id=fixture-deployment
operation=deploy
production_network=fixture-network
approved_production_ipv4=172.19.0.2
gate_count=0
mutations=0
rollback_record() {
 if [[ "$1" == network-state && "$3" == running ]]; then echo RUNNING; return; fi
 [[ "$1" == transition-ready ]] || return 98
 gate_count=$((gate_count+1))
 [[ "$gate_count" != FAILCHECK ]]
}
network_attached_for_container() { echo ATTACHED; }
network_ip_for_container() { echo ''; }
network_static_ip_for_container() { echo ''; }
docker() { mutations=$((mutations+1)); echo MUTATION >&2; }
'''.replace('RUNNING',running).replace('ATTACHED',attached).replace('FAILCHECK',str(failure_check))
     script=prelude+h.extract('assert_transition_ownership')+'\n'+h.extract(name)+'\n'+name+' '+args+' || exit 7\necho UNSAFE_CONTINUATION\n'
     bash='C:/Program Files/Git/bin/bash.exe' if os.name=='nt' else '/bin/bash'
     result=subprocess.run([bash,'--noprofile','--norc'],input=script,text=True,capture_output=True)
     self.assertEqual(result.returncode,7,result.stdout+result.stderr)
     self.assertNotIn('UNSAFE_CONTINUATION',result.stdout)
     self.assertEqual(result.stderr.count('MUTATION'),failure_check-1)

 def test_prepare_only_failure_injection_restores_exact_original(self):
  fixture=t.RecordTests();fixture.setUp()
  try:
   candidate=fixture.prepare_only()
   original=fixture.live[0]['Id'];replacement=candidate[0]['Id']
   # Exercise the real signed prepare-only gates before feeding their exact ID
   # into the extracted controller restoration function.
   fixture.records.restore_ready(t.FUTURE_ID,'deploy',t.FUTURE_TARGET)
   self.assertEqual(fixture.records.replacement_ready(t.FUTURE_ID,'deploy','harvest-api'),replacement)
   script=('''set -Eeuo pipefail
backend_live_container=harvest-api
transaction_backup=harvest-api-pre-test
replacement_origin=''
original_container_id=ORIGINAL
original_image_id=original-image
original_revision='''+t.CURRENT+'''
original_network_ip=172.19.0.2
approved_production_ipv4=172.19.0.2
deployment_id='''+t.FUTURE_ID+'''
operation=deploy
previous_state=/nonexistent-previous-state
state_dir=/nonexistent-state-dir
state_file=/nonexistent-state-file
fixture_live_id=REPLACEMENT
backup_id=ORIGINAL
live_exists=true
backup_exists=true
trace=''
container_exists() {
 [[ "$1" == harvest-api && "$live_exists" == true || "$1" == harvest-api-pre-test && "$backup_exists" == true ]]
}
container_running() { return 1; }
rollback_record() {
 case "$1" in
  restore-ready|restored) return 0;;
  replacement-ready) echo REPLACEMENT;;
  *) return 90;;
 esac
}
assert_transition_ownership() { trace+="ownership:$1:$2:$3 "; }
stop_backend_for_transition() { [[ "$1 $2" == 'harvest-api target' ]]; trace+='stop '; }
disconnect_production_network() { [[ "$1 $2" == 'harvest-api target' ]]; trace+='disconnect '; }
ensure_production_network_ip() { [[ "$1 $2" == 'harvest-api 172.19.0.2' ]]; trace+='connect '; }
start_backend_for_transition() { [[ "$1 $2" == 'harvest-api source' ]]; trace+='start '; }
assert_live_contract() { trace+='contract '; }
docker() {
 if [[ "$1" == inspect && "$2" == --format && "$3" == '{{.Id}}' ]]; then
  [[ "$4" == harvest-api ]] && echo "$fixture_live_id" || echo "$backup_id"
 elif [[ "$1 $2 $3" == 'rm -f REPLACEMENT' ]]; then
  [[ "$fixture_live_id" == REPLACEMENT ]]; live_exists=false; fixture_live_id=''; trace+='remove '
 elif [[ "$1 $2 $3" == 'rename harvest-api-pre-test harvest-api' ]]; then
  [[ "$backup_id" == ORIGINAL ]]; backup_exists=false; live_exists=true; fixture_live_id="$backup_id"; trace+='rename '
 else
  return 91
 fi
}
''').replace('ORIGINAL',original).replace('REPLACEMENT',replacement)
   script+=h.extract('restore_original_backend')+'\nrestore_original_backend\n[[ "$automatic_restore_result" == pass ]]\n[[ "$fixture_live_id" == "'+original+'" ]]\necho "$trace"\n'
   bash='C:/Program Files/Git/bin/bash.exe' if os.name=='nt' else '/bin/bash'
   result=subprocess.run([bash,'--noprofile','--norc'],input=script,text=True,capture_output=True)
   self.assertEqual(result.returncode,0,result.stdout+result.stderr)
   self.assertIn('stop disconnect',result.stdout)
   self.assertIn('remove',result.stdout);self.assertIn('rename',result.stdout);self.assertIn('start',result.stdout)
  finally:fixture.tearDown()

 def test_replacement_identity_output_and_toctou_fail_before_removal(self):
  original='a'*64;replacement='b'*64;changed='c'*64
  for case in ('blank','malformed','mismatch','changed-before-stop','changed-after-stop'):
   with self.subTest(case=case):
    output={'blank':'','malformed':'not-an-id','mismatch':changed}.get(case,replacement)
    change_at={'changed-before-stop':2,'changed-after-stop':3}.get(case,0)
    with t.tempfile.TemporaryDirectory(dir=t.ROOT/'tests') as directory:
     counter=(Path(directory)/'counter').as_posix()
     script=('''set -Eeuo pipefail
backend_live_container=harvest-api
transaction_backup=harvest-api-pre-test
replacement_origin=''
original_container_id=ORIGINAL
original_image_id=original-image
original_revision='''+t.CURRENT+'''
original_network_ip=172.19.0.2
approved_production_ipv4=172.19.0.2
deployment_id='''+t.FUTURE_ID+'''
operation=deploy
previous_state=/nonexistent
state_dir=/nonexistent
state_file=/nonexistent
counter_file=COUNTER
printf '0\n' > "$counter_file"
mutations=''
container_exists() { return 0; }
container_running() { return 1; }
rollback_record() {
 [[ "$1" == restore-ready ]] && return 0
 [[ "$1" == replacement-ready ]] && { printf '%s\\n' 'OUTPUT'; return 0; }
 return 90
}
docker() {
 if [[ "$1" == inspect && "$2" == --format && "$3" == '{{.Id}}' ]]; then
  if [[ "$4" == harvest-api-pre-test ]]; then echo ORIGINAL; return; fi
  inspects=$(cat "$counter_file"); inspects=$((inspects+1)); printf '%s\n' "$inspects" > "$counter_file"
  [[ CHANGEAT -gt 0 && "$inspects" -ge CHANGEAT ]] && echo CHANGED || echo REPLACEMENT
  return
 fi
 mutations+="docker:$* "
}
stop_backend_for_transition() { mutations+='stop '; }
disconnect_production_network() { mutations+='disconnect '; }
assert_transition_ownership() { :; }
ensure_production_network_ip() { mutations+='connect '; }
start_backend_for_transition() { mutations+='start '; }
assert_live_contract() { :; }
''').replace('ORIGINAL',original).replace('REPLACEMENT',replacement).replace('CHANGED',changed).replace('OUTPUT',output).replace('CHANGEAT',str(change_at)).replace('COUNTER',h.shlex.quote(counter))
     script+=h.extract('restore_original_backend')+'\nrestore_original_backend || status=$?\n[[ "${status:-0}" == 1 ]]\necho "$mutations"\n'
     bash='C:/Program Files/Git/bin/bash.exe' if os.name=='nt' else '/bin/bash'
     result=subprocess.run([bash,'--noprofile','--norc'],input=script,text=True,capture_output=True)
     self.assertEqual(result.returncode,0,result.stdout+result.stderr)
     self.assertNotIn('docker:rm',result.stdout);self.assertNotIn('docker:rename',result.stdout)
     self.assertNotIn('start',result.stdout)
     if case=='changed-after-stop':
      self.assertIn('stop disconnect',result.stdout)
     else:
      self.assertNotIn('stop',result.stdout);self.assertNotIn('disconnect',result.stdout)

if __name__=='__main__':unittest.main(verbosity=2)
