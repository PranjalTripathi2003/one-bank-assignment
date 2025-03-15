let file = null;
let data = [];
let error = "";

const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const errorContainer = document.getElementById("errorContainer");
const dataContainer = document.getElementById("dataContainer");
const transactionCount = document.getElementById("transactionCount");
const downloadBtn = document.getElementById("downloadBtn");
const tableBody = document.getElementById("tableBody");

const formatDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return "Invalid Date";
  dateStr = dateStr.trim();
  const dateFormats = [
    { regex: /(\d{2})-(\d{2})-(\d{4})/, parts: [3, 2, 1] },
    { regex: /(\d{2})\/(\d{2})\/(\d{4})/, parts: [3, 2, 1] },
    { regex: /(\d{2})-(\d{2})-(\d{2})/, parts: [3, 2, 1] },
    { regex: /(\d{1,2})-(\d{1,2})-(\d{4})/, parts: [3, 2, 1] },
    { regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, parts: [3, 2, 1] },
    { regex: /(\d{1,2})-(\d{1,2})-(\d{2})/, parts: [3, 2, 1] },
    { regex: /(\d{4})-(\d{2})-(\d{2})/, parts: [1, 2, 3] },
    { regex: /(\d{2})-(\d{2})/, parts: [0, 0] },
  ];

  for (const format of dateFormats) {
    const match = dateStr.match(format.regex);
    if (match) {
      let year, month, day;
      if (format.parts[0] === 0) {
        const currentDate = new Date();
        year = currentDate.getFullYear().toString();
        month = match[2].padStart(2, "0");
        day = match[1].padStart(2, "0");
      } else {
        year = match[format.parts[0]];
        month = match[format.parts[1]].padStart(2, "0");
        day = match[format.parts[2]].padStart(2, "0");
        if (year.length === 2) {
          year = `20${year}`;
        }
      }
      if (parseInt(month) < 1 || parseInt(month) > 12) return "Invalid Date";
      if (parseInt(day) < 1 || parseInt(day) > 31) return "Invalid Date";
      const formattedDate = new Date(`${year}-${month}-${day}`);
      return isNaN(formattedDate.getTime())
        ? "Invalid Date"
        : `${year}-${month}-${day}`;
    }
  }
  console.log("Unrecognized date format:", dateStr);
  return "Invalid Date";
};

const extractLocation = (description) => {
  if (!description) return "N/A";
  const cleanedDesc = description.replace(/EUR|USD|INR|POUND/g, "").trim();
  const words = cleanedDesc.split(/\s+/);
  return words.length > 0 ? words[words.length - 1].toLowerCase() : "N/A";
};

const processRow = (row, bank, cardName) => {
  let date, description, debit, credit, currency, transactionType, location;
  try {
    switch (bank) {
      case "HDFC":
        date = formatDate(row[0] || "N/A");
        description = row[1] || "N/A";
        const amountStrHDFC = (row[2] || "").toString().toLowerCase();
        const numericValueHDFC =
          parseFloat(amountStrHDFC.replace(/[^0-9.]/g, "")) || 0;
        debit = amountStrHDFC.includes("cr") ? 0 : numericValueHDFC;
        credit = amountStrHDFC.includes("cr") ? numericValueHDFC : 0;
        currency = description.includes("EUR")
          ? "EUR"
          : description.includes("USD")
          ? "USD"
          : "INR";
        transactionType =
          description.includes("EUR") || description.includes("USD")
            ? "International"
            : "Domestic";
        location = extractLocation(description);
        break;

      case "ICICI":
        date = formatDate(row[0] || "N/A");
        description = row[1] || "N/A";
        debit = parseFloat(row[2] || 0);
        credit = parseFloat(row[3] || 0);
        currency = description.includes("EUR")
          ? "EUR"
          : description.includes("USD")
          ? "USD"
          : "INR";
        transactionType =
          description.includes("EUR") || description.includes("USD")
            ? "International"
            : "Domestic";
        location = extractLocation(description);
        break;

      case "IDFC":
        let dateColumn = row[1];
        if (!dateColumn || formatDate(dateColumn) === "Invalid Date") {
          for (let i = 0; i < row.length; i++) {
            if (i !== 1 && row[i] && formatDate(row[i]) !== "Invalid Date") {
              dateColumn = row[i];
              console.log("Found date in alternative column:", i, dateColumn);
              break;
            }
          }
        }
        date = formatDate(dateColumn || "N/A");
        description = row[0] || "N/A";
        const amountStrIDFC = (row[2] || "").toString().toLowerCase();
        const numericValueIDFC =
          parseFloat(amountStrIDFC.replace(/[^0-9.]/g, "")) || 0;
        debit = amountStrIDFC.includes("cr") ? 0 : numericValueIDFC;
        credit = amountStrIDFC.includes("cr") ? numericValueIDFC : 0;
        currency = description.includes("EUR")
          ? "EUR"
          : description.includes("USD")
          ? "USD"
          : "INR";
        transactionType =
          description.includes("EUR") || description.includes("USD")
            ? "International"
            : "Domestic";
        location = extractLocation(description);
        break;

      case "AXIS":
        date = formatDate(row[0] || "N/A");
        debit = parseFloat(row[1] || 0);
        credit = parseFloat(row[2] || 0);
        description = row[3] || "N/A";
        currency = description.includes("EUR")
          ? "EUR"
          : description.includes("USD")
          ? "USD"
          : "INR";
        transactionType =
          description.includes("EUR") || description.includes("USD")
            ? "International"
            : "Domestic";
        location = extractLocation(description);
        break;

      default:
        return null;
    }

    return {
      date,
      description,
      debit,
      credit,
      currency,
      cardName,
      transactionType,
      location,
    };
  } catch (err) {
    console.error("Error processing row:", err, row);
    return null;
  }
};

const processDataByBank = (rawData, bank) => {
  const processedData = [];
  let currentCardName = "Unknown";
  let isInDomesticSection = true;
  let isInInternationalSection = false;

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (
      !row ||
      row.length === 0 ||
      row.every((cell) => !cell || cell.trim() === "")
    ) {
      continue;
    }
    const rowText = row.join(" ").toLowerCase();
    if (
      rowText.includes("domestic transaction") ||
      rowText.includes("domestic trans")
    ) {
      isInDomesticSection = true;
      isInInternationalSection = false;
      continue;
    }
    if (
      rowText.includes("international transaction") ||
      rowText.includes("international trans")
    ) {
      isInDomesticSection = false;
      isInInternationalSection = true;
      continue;
    }
    const possibleNames = ["Rahul", "Ritu", "Raj", "Rajat"];
    for (const name of possibleNames) {
      if (row.includes(name) || (row.length > 0 && row[0] === name)) {
        currentCardName = name;
        console.log("Found card name:", currentCardName);
        break;
      }
    }
    if (
      row.includes("Date") ||
      row.includes("Transaction Details") ||
      possibleNames.includes(row[0]) ||
      rowText.includes("date") ||
      rowText.includes("transaction details")
    ) {
      continue;
    }
    let isValidTransactionRow = false;
    switch (bank) {
      case "HDFC":
      case "ICICI":
      case "AXIS":
        isValidTransactionRow =
          row[0] &&
          typeof row[0] === "string" &&
          (/\d{2}-\d{2}-\d{4}/.test(row[0]) ||
            /\d{2}\/\d{2}\/\d{4}/.test(row[0]));
        break;
      case "IDFC":
        isValidTransactionRow =
          row[1] &&
          typeof row[1] === "string" &&
          (/\d{2}-\d{2}-\d{4}/.test(row[1]) ||
            /\d{2}-\d{2}-\d{2}/.test(row[1]));
        break;
    }
    if (isValidTransactionRow) {
      const processedRow = processRow(row, bank, currentCardName);
      if (processedRow) {
        processedData.push(processedRow);
      }
    }
  }
  return processedData;
};

const setErrorMessage = (message) => {
  error = message;
  if (message) {
    errorContainer.textContent = message;
    errorContainer.style.display = "block";
  } else {
    errorContainer.style.display = "none";
  }
};

const renderTable = () => {
  tableBody.innerHTML = "";
  data.forEach((row) => {
    const tr = document.createElement("tr");
    const createCell = (content) => {
      const td = document.createElement("td");
      td.textContent = content;
      return td;
    };
    tr.appendChild(createCell(row.date));
    tr.appendChild(createCell(row.description));
    tr.appendChild(createCell(row.debit > 0 ? row.debit.toFixed(2) : "-"));
    tr.appendChild(createCell(row.credit > 0 ? row.credit.toFixed(2) : "-"));
    tr.appendChild(createCell(row.currency));
    tr.appendChild(createCell(row.cardName));
    tr.appendChild(createCell(row.transactionType));
    tr.appendChild(createCell(row.location));
    tableBody.appendChild(tr);
  });
  transactionCount.textContent = `Parsed Transactions: ${data.length}`;
  dataContainer.style.display = "block";
};

const generateOutputFileName = (inputFileName) => {
  if (inputFileName.includes("Input")) {
    return inputFileName.replace("Input", "Output");
  }
  const lastDotIndex = inputFileName.lastIndexOf(".");
  if (lastDotIndex !== -1) {
    const nameWithoutExt = inputFileName.substring(0, lastDotIndex);
    const extension = inputFileName.substring(lastDotIndex);
    return `${nameWithoutExt}-Output${extension}`;
  }
  return `${inputFileName}-Output.csv`;
};

const handleFileChange = (e) => {
  const selectedFile = e.target.files[0];
  if (!selectedFile) return;
  file = selectedFile;
  fileInfo.textContent = `Selected file: ${file.name}`;
  setErrorMessage("");
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = event.target.result;
      const fileName = selectedFile.name.toLowerCase();
      let bank = null;
      if (fileName.includes("hdfc")) {
        bank = "HDFC";
      } else if (fileName.includes("icici")) {
        bank = "ICICI";
      } else if (fileName.includes("idfc")) {
        bank = "IDFC";
      } else if (fileName.includes("axis")) {
        bank = "AXIS";
      }
      console.log("Detected bank:", bank);
      if (!bank) {
        setErrorMessage(
          "Unsupported bank format. Please upload a valid file with bank name in the filename."
        );
        return;
      }
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        complete: (result) => {
          if (result.data && result.data.length > 0) {
            const processedData = processDataByBank(result.data, bank);
            if (processedData.length === 0) {
              setErrorMessage("No valid transaction data found in the file.");
            } else {
              data = processedData;
              console.log("Processed data:", processedData);
              renderTable();
            }
          } else {
            setErrorMessage("No data found in the CSV file.");
          }
        },
        error: (err) => {
          setErrorMessage(`Error parsing CSV: ${err.message}`);
          console.error("CSV parsing error:", err);
        },
      });
    } catch (err) {
      setErrorMessage(`Error processing file: ${err.message}`);
      console.error("File processing error:", err);
    }
  };
  reader.onerror = () => {
    setErrorMessage("Error reading the file.");
  };
  reader.readAsText(selectedFile);
};

const handleDownload = () => {
  if (data.length === 0) {
    setErrorMessage("No data to download.");
    return;
  }
  try {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const outputFileName = generateOutputFileName(file.name);
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    setErrorMessage(`Error downloading CSV: ${err.message}`);
    console.error("Download error:", err);
  }
};

fileInput.addEventListener("change", handleFileChange);
downloadBtn.addEventListener("click", handleDownload);