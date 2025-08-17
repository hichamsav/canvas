// worker.js

self.onmessage = function(e) {
  const text = e.data;
  // افصل النص لأسطر
  const lines = text.split('\n');
  
  // استخدام Set لحذف التكرار
  const uniqueLinesSet = new Set(lines);
  
  // حول الناتج مرة ثانية لنص
  const uniqueText = Array.from(uniqueLinesSet).join('\n');
  
  // أرسل النتيجة للواجهة
  self.postMessage(uniqueText);
};
