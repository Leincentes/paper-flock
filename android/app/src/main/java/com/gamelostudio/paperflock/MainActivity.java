package com.gamelostudio.paperflock;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class MainActivity extends ComponentActivity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String START_URL =
        "https://" + LOCAL_HOST + "/assets/www/index.html";
    private static final String PENDING_DIAGNOSTIC_KEY =
        "pending-diagnostic-event";

    private WebView webView;
    private OnBackPressedCallback webHistoryBackCallback;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingSaveName;
    private String pendingSaveContent;

    private final ActivityResultLauncher<Intent> openBackupLauncher =
        registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> handleOpenBackupResult(
                result.getResultCode(),
                result.getData()
            )
        );

    private final ActivityResultLauncher<Intent> saveBackupLauncher =
        registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> handleSaveBackupResult(
                result.getResultCode(),
                result.getData()
            )
        );

    @Override
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.enableEdgeToEdge(getWindow());
        WindowInsetsControllerCompat systemBars =
            WindowCompat.getInsetsController(
                getWindow(),
                getWindow().getDecorView()
            );
        systemBars.setAppearanceLightStatusBars(false);
        systemBars.setAppearanceLightNavigationBars(false);

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(
            webView,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );
        setContentView(root);
        applySystemBarInsets(webView);
        configureBackNavigation();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(
            settings.getUserAgentString() + " PaperFlockAndroid/1.6.0"
        );

        WebView.setWebContentsDebuggingEnabled(
            (
                getApplicationInfo().flags
                & ApplicationInfo.FLAG_DEBUGGABLE
            ) != 0
        );

        WebViewAssetLoader assetLoader =
            new WebViewAssetLoader.Builder()
                .addPathHandler(
                    "/assets/",
                    new WebViewAssetLoader.AssetsPathHandler(this)
                )
                .build();

        webView.setWebViewClient(new LocalWebViewClient(assetLoader));
        webView.setWebChromeClient(new LocalWebChromeClient());
        webView.addJavascriptInterface(
            new AndroidBridge(),
            "PaperFlockAndroid"
        );
        webView.loadUrl(START_URL);
    }

    private void applySystemBarInsets(WebView view) {
        ViewCompat.setOnApplyWindowInsetsListener(
            view,
            (target, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                        | WindowInsetsCompat.Type.displayCutout()
                );
                target.setPadding(
                    bars.left,
                    bars.top,
                    bars.right,
                    bars.bottom
                );
                return windowInsets;
            }
        );
        ViewCompat.requestApplyInsets(view);
    }

    private void configureBackNavigation() {
        webHistoryBackCallback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                WebView currentWebView = webView;
                if (
                    currentWebView != null
                    && currentWebView.canGoBack()
                ) {
                    currentWebView.goBack();
                    return;
                }

                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
            }
        };
        getOnBackPressedDispatcher().addCallback(
            this,
            webHistoryBackCallback
        );
    }

    private void updateBackNavigationState(WebView view) {
        if (webHistoryBackCallback != null) {
            webHistoryBackCallback.setEnabled(
                view != null && view.canGoBack()
            );
        }
    }

    private boolean isLocalUri(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
            && LOCAL_HOST.equalsIgnoreCase(uri.getHost())
            && uri.getPath() != null
            && uri.getPath().startsWith("/assets/www/");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(
                this,
                "No app is available to open this link.",
                Toast.LENGTH_SHORT
            ).show();
        }
    }

    private final class LocalWebViewClient extends WebViewClientCompat {
        private final WebViewAssetLoader assetLoader;

        private LocalWebViewClient(WebViewAssetLoader assetLoader) {
            this.assetLoader = assetLoader;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(
            WebView view,
            WebResourceRequest request
        ) {
            return assetLoader.shouldInterceptRequest(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public WebResourceResponse shouldInterceptRequest(
            WebView view,
            String url
        ) {
            return assetLoader.shouldInterceptRequest(Uri.parse(url));
        }

        @Override
        public boolean shouldOverrideUrlLoading(
            WebView view,
            WebResourceRequest request
        ) {
            Uri uri = request.getUrl();
            if (isLocalUri(uri)) {
                return false;
            }
            openExternal(uri);
            return true;
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(
            WebView view,
            String url
        ) {
            Uri uri = Uri.parse(url);
            if (isLocalUri(uri)) {
                return false;
            }
            openExternal(uri);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            updateBackNavigationState(view);
        }

        @Override
        public void doUpdateVisitedHistory(
            WebView view,
            String url,
            boolean isReload
        ) {
            super.doUpdateVisitedHistory(view, url, isReload);
            updateBackNavigationState(view);
        }

        @Override
        @TargetApi(Build.VERSION_CODES.O)
        public boolean onRenderProcessGone(
            WebView view,
            RenderProcessGoneDetail detail
        ) {
            recordPendingDiagnostic(
                detail.didCrash()
                    ? "webview_renderer_crashed"
                    : "webview_renderer_terminated"
            );

            if (view == webView) {
                webView = null;
            }
            view.removeJavascriptInterface("PaperFlockAndroid");
            if (view.getParent() instanceof ViewGroup) {
                ((ViewGroup) view.getParent()).removeView(view);
            }
            view.destroy();

            runOnUiThread(MainActivity.this::recreate);
            return true;
        }
    }

    private final class LocalWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
            WebView view,
            ValueCallback<Uri[]> callback,
            FileChooserParams params
        ) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
            }
            filePathCallback = callback;

            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/json");

            try {
                openBackupLauncher.launch(intent);
                return true;
            } catch (ActivityNotFoundException error) {
                filePathCallback = null;
                Toast.makeText(
                    MainActivity.this,
                    "No file picker is available.",
                    Toast.LENGTH_SHORT
                ).show();
                return false;
            }
        }
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public void saveTextFile(String filename, String content) {
            runOnUiThread(() -> {
                pendingSaveName = sanitizeFilename(filename);
                pendingSaveContent = content == null ? "" : content;

                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/json")
                    .putExtra(Intent.EXTRA_TITLE, pendingSaveName);

                try {
                    saveBackupLauncher.launch(intent);
                } catch (ActivityNotFoundException error) {
                    pendingSaveName = null;
                    pendingSaveContent = null;
                    Toast.makeText(
                        MainActivity.this,
                        "No document app is available.",
                        Toast.LENGTH_SHORT
                    ).show();
                }
            });
        }

        @JavascriptInterface
        public void shareImage(String filename, String dataUrl) {
            runOnUiThread(() -> {
                try {
                    if (
                        dataUrl == null
                        || !dataUrl.startsWith("data:image/png;base64,")
                        || dataUrl.length() > 8_000_000
                    ) {
                        throw new IllegalArgumentException(
                            "Unsupported result-card image."
                        );
                    }

                    int comma = dataUrl.indexOf(',');
                    byte[] bytes = Base64.decode(
                        dataUrl.substring(comma + 1),
                        Base64.DEFAULT
                    );
                    if (bytes.length == 0 || bytes.length > 5_000_000) {
                        throw new IllegalArgumentException(
                            "Result-card image is outside the size limit."
                        );
                    }

                    File directory =
                        new File(getCacheDir(), "shared");
                    if (!directory.exists() && !directory.mkdirs()) {
                        throw new IllegalStateException(
                            "Share directory was unavailable."
                        );
                    }

                    File file = new File(
                        directory,
                        sanitizeImageFilename(filename)
                    );
                    try (
                        FileOutputStream output =
                            new FileOutputStream(file, false)
                    ) {
                        output.write(bytes);
                        output.flush();
                    }

                    Uri uri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        file
                    );
                    Intent share = new Intent(Intent.ACTION_SEND)
                        .setType("image/png")
                        .putExtra(Intent.EXTRA_STREAM, uri)
                        .addFlags(
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                        );
                    startActivity(
                        Intent.createChooser(
                            share,
                            "Share Paper Flock result"
                        )
                    );
                } catch (Exception error) {
                    Toast.makeText(
                        MainActivity.this,
                        "The result card could not be shared.",
                        Toast.LENGTH_LONG
                    ).show();
                    recordPendingDiagnostic(
                        "{\"name\":\"android_result_share_failed\"}"
                    );
                }
            });
        }

        @JavascriptInterface
        public String platformVersion() {
            return "android-1.6.0";
        }

        @JavascriptInterface
        public String consumeDiagnosticEvent() {
            String event = getPreferences(MODE_PRIVATE)
                .getString(PENDING_DIAGNOSTIC_KEY, "");
            if (event == null || event.trim().isEmpty()) {
                return "";
            }
            getPreferences(MODE_PRIVATE)
                .edit()
                .remove(PENDING_DIAGNOSTIC_KEY)
                .apply();
            return event;
        }
    }

    private void recordPendingDiagnostic(String event) {
        getPreferences(MODE_PRIVATE)
            .edit()
            .putString(PENDING_DIAGNOSTIC_KEY, event)
            .apply();
    }

    private String sanitizeFilename(String filename) {
        String candidate =
            filename == null ? "paper-flock-backup.json" : filename;
        candidate = candidate.replaceAll("[^A-Za-z0-9._-]", "-");
        if (!candidate.toLowerCase(Locale.ROOT).endsWith(".json")) {
            candidate += ".json";
        }
        return candidate;
    }

    private String sanitizeImageFilename(String filename) {
        String candidate =
            filename == null ? "paper-flock-result.png" : filename;
        candidate = candidate.replaceAll("[^A-Za-z0-9._-]", "-");
        if (!candidate.toLowerCase(Locale.ROOT).endsWith(".png")) {
            candidate += ".png";
        }
        return candidate;
    }

    private void handleOpenBackupResult(
        int resultCode,
        @Nullable Intent data
    ) {
        if (filePathCallback == null) {
            return;
        }

        Uri[] result = null;
        if (
            resultCode == Activity.RESULT_OK
            && data != null
            && data.getData() != null
        ) {
            result = new Uri[]{data.getData()};
        }

        filePathCallback.onReceiveValue(result);
        filePathCallback = null;
    }

    private void handleSaveBackupResult(
        int resultCode,
        @Nullable Intent data
    ) {
        Uri uri =
            resultCode == Activity.RESULT_OK && data != null
                ? data.getData()
                : null;

        if (
            uri != null
            && pendingSaveContent != null
        ) {
            try (
                OutputStream output =
                    getContentResolver().openOutputStream(uri, "w")
            ) {
                if (output == null) {
                    throw new IllegalStateException(
                        "Document output stream was unavailable."
                    );
                }
                output.write(
                    pendingSaveContent.getBytes(StandardCharsets.UTF_8)
                );
                output.flush();
                Toast.makeText(
                    this,
                    "Paper Flock backup saved.",
                    Toast.LENGTH_SHORT
                ).show();
            } catch (Exception error) {
                Toast.makeText(
                    this,
                    "The backup could not be saved.",
                    Toast.LENGTH_LONG
                ).show();
            }
        }

        pendingSaveName = null;
        pendingSaveContent = null;
    }

    @Override
    protected void onDestroy() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (webHistoryBackCallback != null) {
            webHistoryBackCallback.remove();
            webHistoryBackCallback = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("PaperFlockAndroid");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
