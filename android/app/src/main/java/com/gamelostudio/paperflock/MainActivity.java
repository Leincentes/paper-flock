package com.gamelostudio.paperflock;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final int REQUEST_OPEN_BACKUP = 4101;
    private static final int REQUEST_SAVE_BACKUP = 4102;
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String START_URL =
        "https://" + LOCAL_HOST + "/assets/www/index.html";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingSaveName;
    private String pendingSaveContent;

    @Override
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(21, 26, 50));
        getWindow().setNavigationBarColor(Color.rgb(21, 26, 50));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        }

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

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(
            settings.getUserAgentString() + " PaperFlockAndroid/1.4.4"
        );

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

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

    private void applySystemBarInsets(View view) {
        view.setOnApplyWindowInsetsListener((target, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout()
                );
                target.setPadding(
                    bars.left,
                    bars.top,
                    bars.right,
                    bars.bottom
                );
            } else {
                target.setPadding(
                    insets.getSystemWindowInsetLeft(),
                    insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(),
                    insets.getSystemWindowInsetBottom()
                );
            }
            return insets;
        });
        view.requestApplyInsets();
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
                startActivityForResult(intent, REQUEST_OPEN_BACKUP);
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
                    startActivityForResult(intent, REQUEST_SAVE_BACKUP);
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
        public String platformVersion() {
            return "android-1.4.4";
        }
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

    @Override
    protected void onActivityResult(
        int requestCode,
        int resultCode,
        @Nullable Intent data
    ) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_OPEN_BACKUP) {
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
            return;
        }

        if (requestCode == REQUEST_SAVE_BACKUP) {
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
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("PaperFlockAndroid");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
