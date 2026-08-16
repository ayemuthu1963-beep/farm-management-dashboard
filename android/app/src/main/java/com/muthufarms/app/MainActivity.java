package com.muthufarms.app;

import android.annotation.TargetApi;
import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.WebViewListener;
import java.io.File;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends BridgeActivity {

    private static final int MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
    private static final int MAX_BASE64_CHARACTERS = 36 * 1024 * 1024;
    private static final String ENDPOINT_AUDIT_TAG = "MFMS_ENDPOINT_AUDIT";
    private static final Set<String> AUDITED_ORIGINS = ConcurrentHashMap.newKeySet();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        configureHttpErrorHandling();
        configureBackNavigation(webView);
        configureDownloads(webView);
    }

    private void configureHttpErrorHandling() {
        getBridge().setWebViewClient(new MuthuFarmsWebViewClient(getBridge()));
    }

    private static final class MuthuFarmsWebViewClient extends BridgeWebViewClient {

        MuthuFarmsWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            auditEndpoint(request.getUrl());
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public void onReceivedHttpError(
            WebView view,
            WebResourceRequest request,
            WebResourceResponse errorResponse
        ) {
            Uri uri = request.getUrl();
            Log.w(
                ENDPOINT_AUDIT_TAG,
                "http_status=" + errorResponse.getStatusCode()
                    + " scheme=" + safeAuditValue(uri.getScheme())
                    + " host=" + safeAuditValue(uri.getHost())
                    + " main_frame=" + request.isForMainFrame()
            );
            // Preserve the website's authentication and authorization error pages.
            // Capacitor's default client redirects every main-frame HTTP error to
            // server.errorPath, which incorrectly turns a valid 401/403 response
            // into the offline screen. Genuine network failures still flow through
            // the inherited onReceivedError implementation and use offline.html.
        }

        private static void auditEndpoint(Uri uri) {
            if (uri == null) return;
            String scheme = safeAuditValue(uri.getScheme()).toLowerCase(Locale.ROOT);
            String host = safeAuditValue(uri.getHost()).toLowerCase(Locale.ROOT);
            if (host.isEmpty()) return;
            String origin = scheme + "://" + host;
            if (AUDITED_ORIGINS.add(origin)) {
                Log.i(ENDPOINT_AUDIT_TAG, "scheme=" + scheme + " host=" + host);
            }
        }

        private static String safeAuditValue(String value) {
            return value == null ? "" : value.replaceAll("[^A-Za-z0-9.:-]", "");
        }
    }

    private void configureBackNavigation(WebView webView) {
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        finishAfterTransition();
                    }
                }
            }
        );
    }

    private void configureDownloads(WebView webView) {
        webView.addJavascriptInterface(new MuthuFarmsDownloadBridge(this, webView), "MuthuFarmsDownloads");

        String downloadBridgeScript = readAsset("public/mfms-mobile-download-bridge.js");
        if (downloadBridgeScript != null) {
            getBridge().addWebViewListener(
                new WebViewListener() {
                    @Override
                    public void onPageLoaded(WebView loadedWebView) {
                        if (isTrustedMuthuFarmsUrl(loadedWebView.getUrl())) {
                            loadedWebView.evaluateJavascript(downloadBridgeScript, null);
                        }
                    }
                }
            );
        }

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (!isTrustedMuthuFarmsUrl(url)) {
                Toast.makeText(this, "This download was blocked because its source is not trusted.", Toast.LENGTH_LONG).show();
                return;
            }

            try {
                String fileName = safeFileName(URLUtil.guessFileName(url, contentDisposition, mimeType));
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.setTitle(fileName);
                request.setDescription("Muthu Farms download");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setAllowedOverMetered(true);
                request.setAllowedOverRoaming(false);

                if (userAgent != null && !userAgent.isBlank()) request.addRequestHeader("User-Agent", userAgent);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null && !cookies.isBlank()) request.addRequestHeader("Cookie", cookies);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "Muthu Farms/" + fileName);
                } else {
                    request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "Muthu Farms/" + fileName);
                }

                DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                manager.enqueue(request);
                Toast.makeText(this, "Downloading " + fileName, Toast.LENGTH_SHORT).show();
            } catch (RuntimeException exception) {
                Toast.makeText(this, "The file could not be downloaded.", Toast.LENGTH_LONG).show();
            }
        });
    }

    private String readAsset(String path) {
        try (InputStream stream = getAssets().open(path)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = stream.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (IOException exception) {
            return null;
        }
    }

    private static boolean isTrustedMuthuFarmsUrl(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value);
        if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        return (
            BuildConfig.MFMS_PRIMARY_HOST.equalsIgnoreCase(host) ||
            (!BuildConfig.MFMS_SECONDARY_HOST.isEmpty()
                && BuildConfig.MFMS_SECONDARY_HOST.equalsIgnoreCase(host))
        );
    }

    private static String safeFileName(String value) {
        String name = value == null ? "muthu-farms-download" : value;
        name = name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_").trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) name = "muthu-farms-download";
        return name.length() > 120 ? name.substring(name.length() - 120) : name;
    }

    private static String safeMimeType(String value) {
        if (value == null || !value.matches("^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+$")) {
            return "application/octet-stream";
        }
        return value.toLowerCase(Locale.ROOT);
    }

    private static final class MuthuFarmsDownloadBridge {

        private final MainActivity activity;
        private final WebView webView;

        MuthuFarmsDownloadBridge(MainActivity activity, WebView webView) {
            this.activity = activity;
            this.webView = webView;
        }

        @JavascriptInterface
        public void saveFile(String fileName, String mimeType, String base64Data) {
            if (base64Data == null || base64Data.length() > MAX_BASE64_CHARACTERS) {
                activity.runOnUiThread(() ->
                    Toast.makeText(activity, "The download is too large for secure in-app export.", Toast.LENGTH_LONG).show()
                );
                return;
            }

            activity.runOnUiThread(() -> {
                if (!isTrustedMuthuFarmsUrl(webView.getUrl())) {
                    Toast.makeText(activity, "This download was blocked because its page is not trusted.", Toast.LENGTH_LONG).show();
                    return;
                }

                new Thread(() -> activity.saveBase64Download(fileName, mimeType, base64Data), "mfms-download").start();
            });
        }
    }

    private void saveBase64Download(String requestedName, String requestedMimeType, String base64Data) {
        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            if (bytes.length > MAX_DOWNLOAD_BYTES) throw new IOException("download exceeds size limit");

            String fileName = safeFileName(requestedName);
            String mimeType = safeMimeType(requestedMimeType);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveToMediaStore(fileName, mimeType, bytes);
            } else {
                saveToAppDownloads(fileName, bytes);
            }

            runOnUiThread(() -> Toast.makeText(this, fileName + " saved to Downloads.", Toast.LENGTH_LONG).show());
        } catch (IllegalArgumentException | IOException exception) {
            runOnUiThread(() -> Toast.makeText(this, "The exported file could not be saved.", Toast.LENGTH_LONG).show());
        }
    }

    @TargetApi(Build.VERSION_CODES.Q)
    private void saveToMediaStore(String fileName, String mimeType, byte[] bytes) throws IOException {
        ContentResolver resolver = getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Muthu Farms");
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri item = resolver.insert(collection, values);
        if (item == null) throw new IOException("could not create download");

        try (OutputStream output = resolver.openOutputStream(item)) {
            if (output == null) throw new IOException("could not open download");
            output.write(bytes);
        } catch (IOException exception) {
            resolver.delete(item, null, null);
            throw exception;
        }

        values.clear();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(item, values, null, null);
    }

    private void saveToAppDownloads(String fileName, byte[] bytes) throws IOException {
        File base = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (base == null) throw new IOException("downloads directory unavailable");
        File directory = new File(base, "Muthu Farms");
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("downloads directory unavailable");

        try (OutputStream output = new FileOutputStream(new File(directory, fileName))) {
            output.write(bytes);
        }
    }
}
