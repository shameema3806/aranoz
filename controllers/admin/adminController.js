const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require("../../models/orderSchema"); 
const Product = require("../../models/productSchema");


const pageerror = async(req,res)=>{
  res.render("pagerror")
}

const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}


const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.render("admin-login", { message: "Invalid email or admin account not found" });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.render("admin-login", { message: "Incorrect password" });
    }

   
    req.session.admin = true;
    return res.redirect("/admin");
  } catch (error) {
    console.error("Login error:", error);
    return res.redirect("/pagerror");
  }
};




const loadDashboard = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        const { period = 'monthly', start, end } = req.query;
        const debugProducts = await Product.find().limit(3).lean();
        const [
            totalUsers,
            totalOrders,
            totalProducts,
            totalRevenue,
            salesReportData,
            recentCompletedOrders
        ] = await Promise.all([
            User.countDocuments(),
            Order.countDocuments({ status: { $nin: ['Cancelled', 'Failed'] } }),
            Product.countDocuments({ isBlocked: false , status: 'Available'}),
            calculateTotalRevenue(),
            getSalesReportData(period, start, end),
            getRecentCompletedOrders()
        ]);

        res.render('dashboard', {
            isAdmin: true,
            totalUsers,
            totalOrders,
            totalProducts,
            totalRevenue: totalRevenue.toFixed(2),
            
            // Sales Report Data
            salesReport: salesReportData.summary,
            chartLabels: salesReportData.chartLabels,
            chartData: salesReportData.chartData,
            
            // Filter state
            period,
            startDate: start || '',
            endDate: end || '',
            
            // Recent Orders
            recentCompletedOrders
        });

    } catch (error) {
        console.error('Dashboard Load Error:', error);
        res.redirect('/admin/pageerror');
    }
};

const calculateTotalRevenue = async () => {
    const result = await Order.aggregate([
        {
            $match: {
                status: { $nin: ['Cancelled', 'Failed', 'Returned'] }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$finalAmount' }
            }
        }
    ]);
    
    return result[0]?.total || 0;
};

const getSalesReportData = async (period = 'monthly', startDate, endDate) => {
    let match = {};
    let groupFormat = '%Y-%m-%d';
    let sortOrder = { _id: 1 };

    const now = new Date();

    switch (period) {
        case 'daily':
            const todayStart = new Date(now.setHours(0, 0, 0, 0));
            const todayEnd = new Date(now.setHours(23, 59, 59, 999));
            match.createdOn = { $gte: todayStart, $lte: todayEnd };
            groupFormat = '%H:00'; // Group by hour
            break;

        case 'weekly':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            
            match.createdOn = { $gte: weekStart, $lte: weekEnd };
            groupFormat = '%Y-%m-%d';
            break;

        case 'monthly':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            match.createdOn = { $gte: monthStart, $lte: monthEnd };
            groupFormat = '%Y-%m-%d';
            break;

        case 'yearly':
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            match.createdOn = { $gte: yearStart, $lte: yearEnd };
            groupFormat = '%Y-%m'; // Group by month
            break;

        case 'custom':
            if (startDate && endDate) {
                const customStart = new Date(startDate);
                customStart.setHours(0, 0, 0, 0);
                
                const customEnd = new Date(endDate);
                customEnd.setHours(23, 59, 59, 999);
                
                match.createdOn = { $gte: customStart, $lte: customEnd };
                
                const daysDiff = (customEnd - customStart) / (1000 * 60 * 60 * 24);
                if (daysDiff <= 7) {
                    groupFormat = '%Y-%m-%d';
                } else if (daysDiff <= 60) {
                    groupFormat = '%Y-%m-%d';
                } else {
                    groupFormat = '%Y-%m';
                }
            }
            break;
    }

    match.status = { $nin: ['Cancelled', 'Failed', 'Returned'] };

    const chartAggregation = await Order.aggregate([
        { $match: match },
        {
            $group: {
                _id: { $dateToString: { format: groupFormat, date: '$createdOn' } },
                totalRevenue: { $sum: '$finalAmount' },
                orderCount: { $sum: 1 }
            }
        },
        { $sort: sortOrder }
    ]);

    // Get summary statistics
    const summaryAggregation = await Order.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalAmount: { $sum: '$finalAmount' },
                totalDiscount: { 
                    $sum: { 
                        $add: [
                            { $ifNull: ['$discount', 0] },
                            { $ifNull: ['$couponDiscount', 0] }
                        ]
                    }
                }
            }
        }
    ]);

    const summary = summaryAggregation[0] || {
        totalOrders: 0,
        totalAmount: 0,
        totalDiscount: 0
    };

    // Format chart labels based on period
    const chartLabels = chartAggregation.map(item => {
        if (period === 'daily') {
            return item._id; // Hour format (e.g., "14:00")
        } else if (period === 'yearly') {
            // Convert YYYY-MM to month name
            const [year, month] = item._id.split('-');
            const date = new Date(year, parseInt(month) - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } else {
            // For daily/weekly/monthly, show date
            const date = new Date(item._id);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    });

    const chartData = chartAggregation.map(item => item.totalRevenue);

    return {
        summary,
        chartLabels,
        chartData
    };
};

// Get recent completed orders
const getRecentCompletedOrders = async () => {
    const orders = await Order.find({
        status: { $in: ['Delivered', 'Completed'] }
    })
    .sort({ createdOn: -1 })
    .limit(5)
    .populate('userId', 'name email')
    .lean();

    return orders.map(order => ({
        orderId: order.orderId || order._id.toString().slice(-6),
        customerName: order.userId?.name || 'Guest',
        finalAmount: Number(order.finalAmount || 0),
        status: order.status
    }));
};

// Download sales report (PDF/Excel)
const downloadSalesReport = async (req, res) => {
    try {
        const { format, period = 'monthly', start, end } = req.query;

        // Get report data
        const reportData = await getSalesReportData(period, start, end);
        
        // Get detailed orders for the report
        let match = {};
        match.status = { $nin: ['Cancelled', 'Failed', 'Returned'] };
        
        // Apply date filters
        if (period === 'custom' && start && end) {
            const customStart = new Date(start);
            customStart.setHours(0, 0, 0, 0);
            const customEnd = new Date(end);
            customEnd.setHours(23, 59, 59, 999);
            match.createdOn = { $gte: customStart, $lte: customEnd };
        } else {
            // Use same logic as getSalesReportData for other periods
            const now = new Date();
            switch (period) {
                case 'daily':
                    const todayStart = new Date(now.setHours(0, 0, 0, 0));
                    const todayEnd = new Date(now.setHours(23, 59, 59, 999));
                    match.createdOn = { $gte: todayStart, $lte: todayEnd };
                    break;
                case 'weekly':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    weekEnd.setHours(23, 59, 59, 999);
                    match.createdOn = { $gte: weekStart, $lte: weekEnd };
                    break;
                case 'monthly':
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    match.createdOn = { $gte: monthStart, $lte: monthEnd };
                    break;
                case 'yearly':
                    const yearStart = new Date(now.getFullYear(), 0, 1);
                    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                    match.createdOn = { $gte: yearStart, $lte: yearEnd };
                    break;
            }
        }

        const orders = await Order.find(match)
            .populate('userId', 'name email')
            .sort({ createdOn: -1 })
            .lean();

        if (format === 'pdf') {
            await generatePDFReport(res, reportData, orders, period, start, end);
        } else if (format === 'excel') {
            await generateExcelReport(res, reportData, orders, period, start, end);
        } else {
            res.status(400).send('Invalid format');
        }

    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).send('Error generating report');
    }
};

// Generate PDF Report
const generatePDFReport = async (res, reportData, orders, period, start, end) => {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${period}-${Date.now()}.pdf`);
    
    doc.pipe(res);

    // Header
    doc.fontSize(24).text('Sales Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Period: ${period.toUpperCase()}`, { align: 'center' });
    if (start && end) {
        doc.text(`Date Range: ${start} to ${end}`, { align: 'center' });
    }
    doc.moveDown(2);

    // Summary Section
    doc.fontSize(16).text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total Orders: ${reportData.summary.totalOrders}`);
    doc.text(`Total Amount: ₹${reportData.summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    doc.text(`Total Discount: ₹${reportData.summary.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    doc.moveDown(2);

    // Order Details Table
    doc.fontSize(16).text('Order Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);

    const tableTop = doc.y;
    
    // Table Headers
    doc.text('Order ID', 50, tableTop, { width: 80 });
    doc.text('Customer', 130, tableTop, { width: 100 });
    doc.text('Date', 230, tableTop, { width: 80 });
    doc.text('Amount', 310, tableTop, { width: 70 });
    doc.text('Discount', 380, tableTop, { width: 70 });
    doc.text('Final', 450, tableTop, { width: 70 });
    
    doc.moveDown();
    let yPos = doc.y + 5;

    // Table Rows
    orders.forEach(order => {
        if (yPos > 720) {
            doc.addPage();
            yPos = 50;
        }
        
        doc.text(order.orderId || order._id.toString().slice(-6), 50, yPos, { width: 80 });
        doc.text(order.userId?.name || 'Guest', 130, yPos, { width: 100 });
        doc.text(new Date(order.createdOn).toLocaleDateString(), 230, yPos, { width: 80 });
        doc.text(`₹${(order.totalPrice || 0).toFixed(2)}`, 310, yPos, { width: 70 });
        doc.text(`₹${((order.discount || 0) + (order.couponDiscount || 0)).toFixed(2)}`, 380, yPos, { width: 70 });
        doc.text(`₹${(order.finalAmount || 0).toFixed(2)}`, 450, yPos, { width: 70 });
        
        yPos += 20;
    });

    doc.end();
};

// Generate Excel Report
const generateExcelReport = async (res, reportData, orders, period, start, end) => {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Title
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'Sales Report';
    worksheet.getCell('A1').font = { size: 18, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Period info
    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = `Period: ${period.toUpperCase()}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    worksheet.getCell('A2').font = { size: 12 };

    if (start && end) {
        worksheet.mergeCells('A3:F3');
        worksheet.getCell('A3').value = `Date Range: ${start} to ${end}`;
        worksheet.getCell('A3').alignment = { horizontal: 'center' };
    }

    // Summary section
    worksheet.addRow([]);
    worksheet.addRow(['Summary']);
    worksheet.getCell('A5').font = { bold: true, size: 14 };
    worksheet.addRow(['Total Orders', reportData.summary.totalOrders]);
    worksheet.addRow(['Total Amount', `₹${reportData.summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]);
    worksheet.addRow(['Total Discount', `₹${reportData.summary.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]);
    worksheet.addRow([]);

    // Table headers
    worksheet.addRow(['Order ID', 'Customer', 'Date', 'Amount', 'Discount', 'Final Amount']);
    const headerRow = worksheet.lastRow;
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
    };

    // Data rows
    orders.forEach(order => {
        worksheet.addRow([
            order.orderId || order._id.toString().slice(-6),
            order.userId?.name || 'Guest',
            new Date(order.createdOn).toLocaleDateString(),
            Number(order.totalPrice || 0).toFixed(2),
            Number((order.discount || 0) + (order.couponDiscount || 0)).toFixed(2),
            Number(order.finalAmount || 0).toFixed(2)
        ]);
    });

    // Column widths
    worksheet.columns = [
        { width: 15 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 15 }
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${period}-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
};


const logout = async (req,res)=>{
        try{
          req.session.admin = null;
           res.redirect("/admin/login")
        

        }catch(error){
           console.log("Error destroying error during logout",error);
           res.redirect("/pagerror")
        }
     }




module.exports = {
    loadLogin,
    login,
    loadDashboard,
    downloadSalesReport,
    pageerror,
    logout
}