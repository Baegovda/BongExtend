using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Automation;
class BrowserShortcut {
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder text,int count);
 [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll")] static extern uint SendInput(uint count,INPUT[] inputs,int size);
 [StructLayout(LayoutKind.Sequential)] struct MOUSE { public int x,y;public uint data,flags,time;public UIntPtr extra; }
 [StructLayout(LayoutKind.Sequential)] struct KEY { public ushort key,scan;public uint flags,time;public UIntPtr extra; }
 [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSE mouse;[FieldOffset(0)] public KEY keyboard; }
 [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type;public UNION value; }
 static INPUT Key(ushort key,bool up){return new INPUT{type=1,value=new UNION{keyboard=new KEY{key=key,flags=up?2u:0u}}};}
 static bool Contains(string text,string word){return text.IndexOf(word,StringComparison.OrdinalIgnoreCase)>=0;}
 static int TabState(AutomationElement root,int depth,Stopwatch timer){
  if(root==null||depth>12||timer.ElapsedMilliseconds>1200)return 0;
  try{
   var current=root.Current;if(current.ControlType==ControlType.Document)return 0;
   if(current.ControlType==ControlType.Button){var name=current.Name??"";
    bool tabs=(Contains(name,"tab")||Contains(name,"탭"))&&!Contains(name,"group")&&!Contains(name,"그룹");
    if(tabs&&(Contains(name,"expand")||Contains(name,"펼치")||Contains(name,"확장")||Contains(name,"최대화")))return -1;
    if(tabs&&(Contains(name,"collapse")||Contains(name,"접기")||Contains(name,"축소")||Contains(name,"최소화")))return 1;
   }
   var walker=TreeWalker.ControlViewWalker;
   for(var child=walker.GetFirstChild(root);child!=null;child=walker.GetNextSibling(child)){int found=TabState(child,depth+1,timer);if(found!=0)return found;if(timer.ElapsedMilliseconds>1200)break;}
  }catch{}return 0;
 }
 static string Run(string title,bool expandedHint){
  var window=GetForegroundWindow();uint pid;GetWindowThreadProcessId(window,out pid);
  if(window==IntPtr.Zero||Process.GetProcessById((int)pid).ProcessName!="chrome")return "not-foreground-chrome";
  var text=new StringBuilder(2048);GetWindowText(window,text,text.Capacity);
  if(String.IsNullOrWhiteSpace(title)||!text.ToString().StartsWith(title,StringComparison.Ordinal))return "different-tab";
  int state=TabState(AutomationElement.FromHandle(window),0,Stopwatch.StartNew());
  if(state<0)return "already-collapsed";
  if(state==0&&!expandedHint)return "state-unknown";
  foreach(int key in new[]{0x10,0x11,0x12,0x5B,0x5C,0x4C})if((GetAsyncKeyState(key)&0x8000)!=0)return "keys-busy";
  if(GetForegroundWindow()!=window)return "focus-changed";
  text.Clear();GetWindowText(window,text,text.Capacity);if(!text.ToString().StartsWith(title,StringComparison.Ordinal))return "different-tab";
  var input=new[]{Key(0x11,false),Key(0x10,false),Key(0x4C,false),Key(0x4C,true),Key(0x10,true),Key(0x11,true)};
  uint sent=SendInput((uint)input.Length,input,Marshal.SizeOf(typeof(INPUT)));
  if(sent<input.Length)SendInput(3,new[]{Key(0x4C,true),Key(0x10,true),Key(0x11,true)},Marshal.SizeOf(typeof(INPUT)));
  return sent==input.Length?"shortcut-sent":"input-failed";
 }
 static int Main(string[] args){try{if(args.Length!=2)return 1;Console.WriteLine(Run(args[0],args[1]=="expanded"));return 0;}catch{Console.WriteLine("unavailable");return 1;}}
}
