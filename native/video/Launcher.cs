using System;
using System.IO;
using System.Diagnostics;
using System.Threading.Tasks;
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
 static int Main() {
  try {
   string dir=AppDomain.CurrentDomain.BaseDirectory;
   string python=File.ReadAllText(Path.Combine(dir,"python.txt")).Trim();
   var start=new ProcessStartInfo(python,"-u \""+Path.Combine(dir,"host.py")+"\"") {UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=dir};
   using(var p=Process.Start(start)) {
    var input=Task.Run(async()=>{try {await Forward(Console.OpenStandardInput(),p.StandardInput.BaseStream);p.StandardInput.Close();}catch{}});
    var output=Forward(p.StandardOutput.BaseStream,Console.OpenStandardOutput());
    var error=p.StandardError.ReadToEndAsync(); output.Wait();p.WaitForExit();return p.ExitCode;
   }
  } catch { return 1; }
 }
}
