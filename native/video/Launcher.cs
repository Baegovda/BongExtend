using System;
using System.IO;
using System.Diagnostics;
using System.Threading.Tasks;
// 크롬이 부르는 실행기. Rust 보조 프로그램(bongextend-video-host.exe)이 있으면 그걸 쓰고,
// 없거나 띄우지 못하면 예전 파이썬(host.py)으로 돌아가요. 크롬과 보조 프로그램 사이의 메시지는 그대로 옮기기만 해요.
class Launcher {
 static async Task Forward(Stream source,Stream target) {
  while(true){
   byte[] header=new byte[4];if(!await ReadAll(source,header))return;
   int size=BitConverter.ToInt32(header,0);if(size<0||size>1048576)return;
   byte[] data=new byte[size];if(!await ReadAll(source,data))return;
   await target.WriteAsync(header,0,4);await target.WriteAsync(data,0,size);await target.FlushAsync();
  }
 }
 static async Task<bool> ReadAll(Stream source,byte[] data){int offset=0;while(offset<data.Length){int count=await source.ReadAsync(data,offset,data.Length-offset);if(count==0)return false;offset+=count;}return true;}
 static ProcessStartInfo Info(string file,string args,string dir) {
  return new ProcessStartInfo(file,args) {UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=dir};
 }
 static Process StartHelper(string dir) {
  string rust=Path.Combine(dir,"bongextend-video-host.exe");
  if(File.Exists(rust)) {
   try { return Process.Start(Info(rust,"",dir)); } catch { /* 예전 파이썬으로 돌아가요. */ }
  }
  string python=File.ReadAllText(Path.Combine(dir,"python.txt")).Trim();
  return Process.Start(Info(python,"-u \""+Path.Combine(dir,"host.py")+"\"",dir));
 }
 static int Main() {
  try {
   string dir=AppDomain.CurrentDomain.BaseDirectory;
   using(var p=StartHelper(dir)) {
    var input=Task.Run(async()=>{try {await Forward(Console.OpenStandardInput(),p.StandardInput.BaseStream);p.StandardInput.Close();}catch{}});
    var output=Forward(p.StandardOutput.BaseStream,Console.OpenStandardOutput());
    var error=p.StandardError.ReadToEndAsync(); output.Wait();p.WaitForExit();return p.ExitCode;
   }
  } catch { return 1; }
 }
}
