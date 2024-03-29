const { query } = require('express');
const Categorydb =require('../model/categorymodel');
const Productdb =require('../model/productmodel');
const Addressdb =require('../model/addressmodel');
const Cartdb =require('../model/cartmodel');
const Orderdb =require('../model/ordermodel');
const multer = require('multer');
const sharp = require('sharp');
const path= require('path');
const Userdb = require('../model/model');
const Coupondb = require('../model/couponmodel');
const Wallet =require('../model/wallethistory')
// Import Razorpay SDK
const Razorpay = require('razorpay');

const razorpayKeyId = 'rzp_test_l0JN45NspADoRo';
// Initialize Razorpay with your API key and secret
const razorpay = new Razorpay({
    key_id: 'rzp_test_l0JN45NspADoRo',
    key_secret: 'bRhaVuy5fdvjABsEcAPA71IX'
});

exports.placeorder = async (req, res) => {
    if(req.cookies.userToken){
    try {
        const { addressId, paymentMethod, totalAmount,couponcode } = req.body;

        console.log(couponcode)
        const today = new Date();
        const user = await Userdb.findOne({ email: req.session.email });
        const userId = user._id;
        const address = await Addressdb.findById(addressId);
        const cart = await Cartdb.findOne({ user: userId }).populate('items.productId')
        const addresses= await Addressdb.find({user: userId});
        const coupons = await Coupondb.find({ expiredate: { $gte: today } });
        if(!addressId){
            return res.render('checkout', {couponApplied:true ,addresses: addresses,cart: cart, coupons: coupons, userToken: req.cookies.userToken,user: user, message: 'No address is selected. Please select an address to proceed.' });
        }
        let couponUsed;
            let finalTotalAmount = totalAmount;

            // Check if a valid coupon code is provided
            if (couponcode) {
                const coupon = await Coupondb.findOne({ couponcode: couponcode });
                console.log(coupon)
                if (!coupon) {
                    return res.status(404).json({ message: 'Coupon not found' });
                }
                couponUsed = coupon._id;
                // Subtract coupon discount from the total amount
                finalTotalAmount -= coupon.maxdiscount;
            }
            console.log('asdfghjk',finalTotalAmount)
        // If payment method is Razorpay
        if (paymentMethod === 'online') {
            const cart = await Cartdb.findOne({ user: userId }).populate('items.productId');
            const razorpayOrder = await razorpay.orders.create({
                amount: totalAmount * 100,
                currency: 'INR',
                payment_capture: 1 
            });
            const items = cart.items.map(item => ({
                productId: item.productId._id, 
                quantity: item.quantity,
                price: item.productId.total_price
            }));
            const order = new Orderdb({
                userId: userId,
                items: items,
                orderedDate: new Date(),
                status: 'Order Payment Failed', 
                shippingAddress: address,
                paymentMethod: paymentMethod,
                paymentStatus : 'Failed',
                totalAmount: finalTotalAmount,
                razorpayOrderId: razorpayOrder.id,
                couponused: couponUsed
            });

            await order.save();
            await Cartdb.deleteOne({ user: user._id });

            return res.redirect(`/razorpay/checkout/${order._id}`);
        } else if (paymentMethod === 'cod') {               
                const user = await Userdb.findOne({ email: req.session.email });
                const userId = user._id;
                
                const address = await Addressdb.findById(addressId);
                const cart = await Cartdb.findOne({ user: userId }).populate('items.productId');
                if(cart){
                if (!cart || !cart.items || cart.items.length === 0) {
                    res.redirect('/cart');
                }
                const items = cart.items.map(item => ({
                    productId: item.productId._id, 
                    quantity: item.quantity,
                    price: item.productId.total_price
                }));
        
                const order = new Orderdb({
                    userId: userId,
                    items: items,
                    orderedDate: new Date(),
                    status: 'Order Placed',
                    shippingAddress: address,
                    paymentMethod: paymentMethod,
                    totalAmount: finalTotalAmount,
                    couponused: couponUsed
                });
        
                await order.save();

                await Cartdb.deleteOne({ user: userId });

                for (const item of cart.items) {
                    console.log(item.productId);
                    await Productdb.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
                }
                res.render('ordersuccess',{userToken: req.cookies.userToken,user: user})
            
        } else {

            return res.redirect('/cart');
        }
        }
        else if(paymentMethod === 'wallet'){
            const user = await Userdb.findOne({ email: req.session.email });
            const userId = user._id;
            
            const address = await Addressdb.findById(addressId);
            const cart = await Cartdb.findOne({ user: userId }).populate('items.productId');
            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect('/cart');
            }
        
            const items = cart.items.map(item => ({
                productId: item.productId._id, 
                quantity: item.quantity,
                price: item.productId.total_price
            }));
        
            const order = new Orderdb({
                userId: userId,
                items: items,
                orderedDate: new Date(),
                status: 'Order Placed',
                shippingAddress: address,
                paymentMethod: paymentMethod,
                totalAmount: finalTotalAmount,
                paymentStatus : 'Paid',
                couponused: couponUsed
            });
        
            await order.save();
            const debitTransaction = new Wallet({
                userId: userId,
                transactionType: 'Debit',
                amount: finalTotalAmount,
                order: order.orderId, 
                state: "Buyed",
                timestamp: new Date()
            });
            await debitTransaction.save();
            await Cartdb.deleteOne({ user: userId });
        
            // Subtract totalAmount from walletAmount
            user.walletAmount -= totalAmount;
            await user.save();
        
            for (const item of cart.items) {
                console.log(item.productId);
                await Productdb.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
            }
        
            res.render('ordersuccess', { userToken: req.cookies.userToken, user: user });
        } else {
            return res.redirect('/cart');
        }        
    } catch (error) {
        // Handle errors
        console.error(error);
        return res.redirect('/cart');
    }
}
};

exports.userorders=async (req, res) => {
    if(req.cookies.userToken){
    try {
      const user = await Userdb.findOne({ email: req.session.email });
      const userId= user._id;
        const orders = await Orderdb.find({ userId: user._id}).populate('items.productId').sort({_id:-1});
        const dates = orders.map(order => order.orderedDate.toDateString());
         
        res.render('userorders', { userToken: req.cookies.userToken,user: user, orders, dates });
    } catch (error) {
        console.error('Error fetching user orders:', error);
         
         res.render('404');
    }
}
};
exports.userorderdetails=async (req, res) => {
    if(req.cookies.userToken){
    try {
        const orderId = req.params.orderId;
        const user = await Userdb.findOne({ email: req.session.email });

        const order = await Orderdb.findById(orderId).populate('items.productId');
        if (!order) {
            return res.status(404).send('Order not found');
        }

        res.render('userorderdetails', {userToken: req.cookies.userToken,user: user, order: order });
    } catch (error) {
        console.error('Error fetching order details:', error);
         res.render('404');
    }
  }
}
 exports.userordercancel= async (req, res) => {
    if(req.cookies.userToken){
    try {
        const order = await Orderdb.findById(req.params.orderId);
        const user = await Userdb.findOne({ email: req.session.email });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
       }
       if(order.paymentMethod=='online' || order.paymentMethod=='wallet'){
        user.walletAmount+= order.totalAmount;
        const creditTransaction = new Wallet({
            userId: user._id,
            transactionType: 'Credit',
            amount: order.totalAmount,
            order: order.orderId, 
            state: "Cancelled",
            timestamp: new Date()
        });
        await creditTransaction.save();
       }
     order.status = 'Cancelled';
     for (const item of order.items) {
        const product = await Productdb.findById(item.productId);
    
        if (product) {
            product.stock += item.quantity;  
            await product.save()
        } else {
            console.log(`Product with ID ${item.productId} not found`);
        }
    }
        await order.save();
        await user.save();

        res.redirect('/userorders')
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.render('404');
    }
}
};
exports.userorderreturn=async (req, res) => {
    try {
        const order = await Orderdb.findById(req.params.orderId);
        const user = await Userdb.findOne({ email: req.session.email });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
       }
       order.status = 'Return Requested';
        await order.save();
        await user.save();

        res.redirect('/userorders')
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.render('404');
    }
};
exports.cancelorderreturn=async (req, res) => {
    try {
        const order = await Orderdb.findById(req.params.orderId);
        const user = await Userdb.findOne({ email: req.session.email });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
       }
        order.status = 'Delivered';
        await order.save();
        await user.save();

        res.redirect('/userorders')
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.render('404');
    }
};
exports.razor=async (req, res) => {
    try {
        const user = await Userdb.findOne({ email: req.session.email });
        const orderId = req.params.orderId;
        // Fetch the order details from the database based on the orderId
        const order = await Orderdb.findById(orderId);
        if (!order) {
            return res.redirect('/cart'); 
        }
        res.render('razorpay_checkout', { order: order,razorpayKeyId: razorpayKeyId,user:user,userToken: req.cookies.userToken });
    } catch (error) {
        console.error(error);
        res.redirect('/cart');
    }
  }

  exports.razorsuccess = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orderdb.findById(orderId).populate('items.productId');
        console.log(order);

        if (!order) {
            return res.redirect('/error');
        }

        const user = await Userdb.findOne({ email: req.session.email });

        for (const item of order.items) {
            console.log(item.productId);
            await Productdb.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
        }

        order.status = 'Order Placed';
        order.paymentStatus = 'Paid';
        await order.save();

        res.render('ordersuccess', { userToken: req.cookies.userToken, user: user });
    } catch (error) {
        console.error(error);
        return res.redirect('/cart');
    }
};

exports.wallethistory = async (req, res) => {
    try {
        if (!req.cookies.userToken) {
            return res.redirect('/login'); // Redirect if user is not logged in
        }

        const user = await Userdb.findOne({ email: req.session.email });
        if (!user) {
            return res.redirect('/login'); // Redirect if user not found
        }

        const userId = user._id;
        const walletHistory = await Wallet.find({ userId }).sort({ timestamp: -1 });

        res.render('wallethistory', { 
            userToken: req.cookies.userToken,
            user: user,
            walletHistory: walletHistory
        });
    } catch (error) {
        console.error('Error fetching wallet history:', error);
        res.render('404');
    }
};

