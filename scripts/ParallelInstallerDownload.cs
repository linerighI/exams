using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;

namespace SchoolInstaller
{
    public sealed class ParallelDownload
    {
        private long received;
        public long Received { get { return Interlocked.Read(ref received); } }

        public async Task DownloadAsync(string url, string cache, string destination, long size,
            int chunkSize = 16777216, int connections = 4)
        {
            if (size < 1 || chunkSize < 1 || connections < 1 || connections > 8)
                throw new ArgumentException("Invalid download parameters.");
            Directory.CreateDirectory(cache);
            Interlocked.Exchange(ref received, 0);
            ServicePointManager.DefaultConnectionLimit = Math.Max(8, connections);
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            using (var client = new HttpClient())
            using (var cancel = new CancellationTokenSource(TimeSpan.FromMinutes(30)))
            using (var slots = new SemaphoreSlim(connections))
            {
                client.Timeout = TimeSpan.FromMinutes(30);
                client.DefaultRequestHeaders.UserAgent.ParseAdd("Alshereqi-Exams-Online-Setup/2.0");
                var tasks = new List<Task>();
                for (long start = 0, index = 0; start < size; start += chunkSize, index++)
                {
                    var end = Math.Min(size - 1, start + chunkSize - 1);
                    var part = Path.Combine(cache, index.ToString("D5") + ".part");
                    long existing = File.Exists(part) ? new FileInfo(part).Length : 0;
                    if (existing > end - start + 1) { File.Delete(part); existing = 0; }
                    Interlocked.Add(ref received, existing);
                    tasks.Add(DownloadPart(client, slots, cancel.Token, url, part, start, end, size));
                }
                await Task.WhenAll(tasks).ConfigureAwait(false);
                using (var output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    for (long start = 0, index = 0; start < size; start += chunkSize, index++)
                    {
                        using (var input = File.OpenRead(Path.Combine(cache, index.ToString("D5") + ".part")))
                            await input.CopyToAsync(output, 262144, cancel.Token).ConfigureAwait(false);
                    }
                }
            }
        }

        private async Task DownloadPart(HttpClient client, SemaphoreSlim slots, CancellationToken cancel,
            string url, string part, long start, long end, long total)
        {
            await slots.WaitAsync(cancel).ConfigureAwait(false);
            try
            {
                for (int attempt = 0; attempt < 3; attempt++)
                {
                    long existing = File.Exists(part) ? new FileInfo(part).Length : 0;
                    if (existing == end - start + 1) return;
                    try
                    {
                        using (var request = new HttpRequestMessage(HttpMethod.Get, url))
                        {
                            request.Headers.Range = new RangeHeaderValue(start + existing, end);
                            using (var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancel).ConfigureAwait(false))
                            {
                                var range = response.Content.Headers.ContentRange;
                                bool entireSmallFile = start == 0 && existing == 0 && end == total - 1 && response.StatusCode == HttpStatusCode.OK;
                                if (!entireSmallFile && (response.StatusCode != HttpStatusCode.PartialContent || range == null ||
                                    range.From != start + existing || range.To != end || range.Length != total))
                                    throw new IOException("The server returned an invalid download range.");
                                response.EnsureSuccessStatusCode();
                                using (var input = await response.Content.ReadAsStreamAsync().ConfigureAwait(false))
                                using (var output = new FileStream(part, FileMode.Append, FileAccess.Write, FileShare.Read))
                                {
                                    var buffer = new byte[262144];
                                    int count;
                                    while ((count = await input.ReadAsync(buffer, 0, buffer.Length, cancel).ConfigureAwait(false)) > 0)
                                    {
                                        if (output.Length + count > end - start + 1)
                                            throw new IOException("Download exceeded its expected size.");
                                        await output.WriteAsync(buffer, 0, count, cancel).ConfigureAwait(false);
                                        Interlocked.Add(ref received, count);
                                    }
                                    if (output.Length != end - start + 1) throw new IOException("Download interrupted.");
                                }
                            }
                        }
                        return;
                    }
                    catch (Exception error)
                    {
                        if (error is OperationCanceledException || attempt == 2) throw;
                    }
                    await Task.Delay(1000 * (attempt + 1), cancel).ConfigureAwait(false);
                }
            }
            finally { slots.Release(); }
        }
    }
}
