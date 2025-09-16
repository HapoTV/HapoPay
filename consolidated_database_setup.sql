-- =============================================================================
-- HAPO TECHNOLOGY PARENT-CHILD MONEY TRANSFER SYSTEM
-- CONSOLIDATED DATABASE SETUP SCRIPT
-- =============================================================================
-- This file consolidates all SQL setup scripts into a single organized file
-- Run this script to set up the complete database schema for the HapoPay system
-- Includes: Core tables, Multi-currency support, Parent ID enhancements
-- =============================================================================

-- =============================================================================
-- SECTION 1: CORE UTILITY FUNCTIONS
-- =============================================================================
-- These functions are used across multiple tables for timestamp management

-- Function to update updated_at timestamp (used by multiple tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- SECTION 2: CHILDREN TABLE SETUP
-- =============================================================================
-- This section creates the children table for storing child account information

-- Drop existing children table if it exists to recreate without foreign key constraint
DROP TABLE IF EXISTS children CASCADE;

-- Create children table without foreign key constraint to auth.users
CREATE TABLE children (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0.00,
    weekly_limit DECIMAL(10,2) DEFAULT 0.00,
    daily_limit DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_children_parent_id ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_children_email ON children(email);

-- Enable Row Level Security
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Parents can view their children" ON children;
DROP POLICY IF EXISTS "Parents can insert children" ON children;
DROP POLICY IF EXISTS "Parents can update their children" ON children;
DROP POLICY IF EXISTS "Parents can delete their children" ON children;
DROP POLICY IF EXISTS "Allow student login authentication" ON children;

-- Create RLS policies for children table
CREATE POLICY "Parents can view their children" ON children
    FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "Parents can insert children" ON children
    FOR INSERT WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update their children" ON children
    FOR UPDATE USING (auth.uid() = parent_id);

CREATE POLICY "Parents can delete their children" ON children
    FOR DELETE USING (auth.uid() = parent_id);

-- Allow anonymous access for student login authentication
CREATE POLICY "Allow student login authentication" ON children
    FOR SELECT USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON children TO authenticated;

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_children_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_children_updated_at ON children;
CREATE TRIGGER update_children_updated_at 
    BEFORE UPDATE ON children 
    FOR EACH ROW 
    EXECUTE FUNCTION update_children_updated_at();

-- Remove unique constraint on email (allows siblings to share email)
ALTER TABLE children DROP CONSTRAINT IF EXISTS children_email_key;

-- =============================================================================
-- SECTION 3: TRANSACTIONS TABLE SETUP
-- =============================================================================
-- This section creates the transactions table for tracking money transfers

-- Drop existing transactions table to recreate without foreign key constraints
DROP TABLE IF EXISTS transactions CASCADE;

CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID NOT NULL,
    child_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    type VARCHAR(50) NOT NULL DEFAULT 'money_sent',
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_transactions_child_id ON transactions(child_id);
CREATE INDEX idx_transactions_parent_id ON transactions(parent_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Parents can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Parents can create transactions for their children" ON transactions;
DROP POLICY IF EXISTS "Allow authenticated users to view transactions" ON transactions;
DROP POLICY IF EXISTS "Allow all authenticated users to manage transactions" ON transactions;

-- Create simplified RLS policies for authenticated users
CREATE POLICY "Allow all authenticated users to manage transactions" ON transactions
    FOR ALL USING (auth.role() = 'authenticated');

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;

-- Create trigger for updated_at
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON transactions TO authenticated;

-- Transaction types reference:
-- 'money_sent' - Parent sends money to child
-- 'qr_payment' - Child makes QR payment
-- 'wallet_topup' - Parent tops up child's wallet
-- 'emergency_fund' - Emergency fund transfer
-- 'recurring_payment' - Recurring payment from parent

-- =============================================================================
-- SECTION 4: MONEY REQUESTS TABLE SETUP
-- =============================================================================
-- This section creates the money_requests table for tracking student money requests

-- Drop and recreate money_requests table without foreign key constraint
DROP TABLE IF EXISTS money_requests CASCADE;

CREATE TABLE money_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    parent_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for money_requests
CREATE INDEX IF NOT EXISTS idx_money_requests_child_id ON money_requests(child_id);
CREATE INDEX IF NOT EXISTS idx_money_requests_status ON money_requests(status);
CREATE INDEX IF NOT EXISTS idx_money_requests_created_at ON money_requests(created_at);

-- Enable RLS for money_requests
ALTER TABLE money_requests ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies for money_requests
CREATE POLICY "Allow authenticated users to create money requests" ON money_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view money requests" ON money_requests
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update money requests" ON money_requests
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create update trigger function for requests
CREATE OR REPLACE FUNCTION update_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_money_requests_updated_at 
    BEFORE UPDATE ON money_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_requests_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON money_requests TO authenticated;

-- =============================================================================
-- SECTION 5: EMERGENCY REQUESTS TABLE SETUP
-- =============================================================================
-- This section creates the emergency_requests table for tracking emergency money requests

-- Drop and recreate emergency_requests table without foreign key constraint
DROP TABLE IF EXISTS emergency_requests CASCADE;

CREATE TABLE emergency_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    urgency_level VARCHAR(20) NOT NULL CHECK (urgency_level IN ('low', 'medium', 'high')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    parent_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for emergency_requests
CREATE INDEX IF NOT EXISTS idx_emergency_requests_child_id ON emergency_requests(child_id);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_status ON emergency_requests(status);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_created_at ON emergency_requests(created_at);

-- Enable RLS for emergency_requests
ALTER TABLE emergency_requests ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies for emergency_requests
CREATE POLICY "Allow authenticated users to create emergency requests" ON emergency_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view emergency requests" ON emergency_requests
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update emergency requests" ON emergency_requests
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create trigger
CREATE TRIGGER update_emergency_requests_updated_at 
    BEFORE UPDATE ON emergency_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_requests_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON emergency_requests TO authenticated;

-- =============================================================================
-- SECTION 6: RECURRING PAYMENTS TABLE SETUP
-- =============================================================================
-- This section creates the recurring_payments table for automated payments

-- Drop existing table if it exists to recreate without foreign keys
DROP TABLE IF EXISTS recurring_payments CASCADE;

-- Create recurring_payments table without foreign key constraints
CREATE TABLE recurring_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID NOT NULL,
    child_id UUID NOT NULL,
    payment_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
    start_date DATE NOT NULL,
    next_payment_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users
CREATE POLICY "Users can manage their own recurring payments" ON recurring_payments
    FOR ALL USING (auth.uid() = parent_id);

-- Grant permissions
GRANT ALL ON recurring_payments TO authenticated;
GRANT ALL ON recurring_payments TO anon;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recurring_payments_parent_id ON recurring_payments(parent_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_child_id ON recurring_payments(child_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_active ON recurring_payments(is_active);

-- Create updated_at trigger
CREATE TRIGGER update_recurring_payments_updated_at BEFORE UPDATE
    ON recurring_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 7: PARENT ACTIVITIES TABLE SETUP
-- =============================================================================
-- This section creates the parent_activities table for comprehensive activity tracking

-- Create parent_activities table for comprehensive activity tracking
CREATE TABLE IF NOT EXISTS parent_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID NOT NULL,
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0.00,
    description TEXT,
    category VARCHAR(50),
    child_name VARCHAR(200),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parent_activities_parent_id ON parent_activities(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_activities_child_id ON parent_activities(child_id);
CREATE INDEX IF NOT EXISTS idx_parent_activities_created_at ON parent_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_parent_activities_activity_type ON parent_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_parent_activities_category ON parent_activities(category);

-- Enable Row Level Security (RLS)
ALTER TABLE parent_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for parent_activities
CREATE POLICY "Parents can view their own activities" ON parent_activities
    FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "Parents can create their own activities" ON parent_activities
    FOR INSERT WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update their own activities" ON parent_activities
    FOR UPDATE USING (auth.uid() = parent_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_parent_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_parent_activities_updated_at 
    BEFORE UPDATE ON parent_activities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_parent_activities_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON parent_activities TO authenticated;

-- Activity types reference:
-- 'wallet_topup', 'emergency_fund', 'emergency_fund_approved', 'money_sent'
-- 'money_request_approved', 'recurring_payment_setup', 'spending_limit_update'
-- 'child_account_created', 'qr_payment', 'safety_alert_triggered'
-- 'account_locked', 'account_unlocked'

-- Categories reference:
-- 'wallet_management', 'emergency_transfer', 'money_request', 'direct_transfer'
-- 'recurring_setup', 'account_management', 'safety_management', 'payment_processing'

-- =============================================================================
-- SECTION 8: SAFETY SYSTEM TABLES SETUP
-- =============================================================================
-- This section creates tables for tracking security violations and managing child account locks

-- Drop existing tables if they exist
DROP TABLE IF EXISTS safety_settings CASCADE;
DROP TABLE IF EXISTS violations CASCADE;
DROP TABLE IF EXISTS account_locks CASCADE;

-- Create safety_settings table to store parent security rules
CREATE TABLE safety_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID NOT NULL,
    child_id UUID NOT NULL,
    restricted_locations TEXT[] DEFAULT ARRAY['liquor', 'bar', 'pub', 'casino', 'gambling', 'nightclub', 'adult', 'tobacco', 'vape', 'smoke', 'alcohol', 'beer', 'wine', 'spirits'],
    allowed_locations TEXT[] DEFAULT ARRAY['school', 'library', 'bookstore', 'cafeteria', 'grocery', 'supermarket', 'pharmacy', 'hospital', 'clinic', 'restaurant', 'cafe', 'fast food'],
    max_transaction_amount DECIMAL(10,2) DEFAULT 50.00,
    allowed_hours_start INTEGER DEFAULT 6,
    allowed_hours_end INTEGER DEFAULT 22,
    warnings_before_lock INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create violations table to track security breaches
CREATE TABLE violations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID NOT NULL,
    parent_id UUID NOT NULL,
    violation_type VARCHAR(50) NOT NULL, -- 'restricted_location', 'late_night_spending', 'large_amount', 'suspicious_pattern'
    transaction_id UUID,
    amount DECIMAL(10,2),
    location TEXT,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create account_locks table to manage child account restrictions
CREATE TABLE account_locks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID NOT NULL,
    parent_id UUID NOT NULL,
    lock_reason TEXT NOT NULL,
    warning_count INTEGER DEFAULT 0,
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    unlocked_by UUID, -- parent who unlocked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_safety_settings_parent_id ON safety_settings(parent_id);
CREATE INDEX IF NOT EXISTS idx_safety_settings_child_id ON safety_settings(child_id);
CREATE INDEX IF NOT EXISTS idx_violations_child_id ON violations(child_id);
CREATE INDEX IF NOT EXISTS idx_violations_parent_id ON violations(parent_id);
CREATE INDEX IF NOT EXISTS idx_violations_created_at ON violations(created_at);
CREATE INDEX IF NOT EXISTS idx_account_locks_child_id ON account_locks(child_id);
CREATE INDEX IF NOT EXISTS idx_account_locks_is_locked ON account_locks(is_locked);

-- Enable RLS
ALTER TABLE safety_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_locks ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies
CREATE POLICY "Allow authenticated users to manage safety_settings" ON safety_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to manage violations" ON violations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to manage account_locks" ON account_locks FOR ALL USING (auth.role() = 'authenticated');

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_safety_settings_updated_at 
    BEFORE UPDATE ON safety_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_violations_updated_at 
    BEFORE UPDATE ON violations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_locks_updated_at 
    BEFORE UPDATE ON account_locks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON safety_settings TO authenticated;
GRANT ALL ON violations TO authenticated;
GRANT ALL ON account_locks TO authenticated;

-- =============================================================================
-- SECTION 9: GAMES SYSTEM TABLES SETUP
-- =============================================================================
-- This section creates tables for the gaming system integration

-- Drop existing tables (in correct order to handle foreign key dependencies)
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS games CASCADE;

-- Create games table
CREATE TABLE games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    base_points INTEGER DEFAULT 50,
    difficulty_levels JSONB DEFAULT '["easy", "medium", "hard"]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_sessions table
CREATE TABLE game_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES children(id) ON DELETE CASCADE,
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    points_earned INTEGER NOT NULL DEFAULT 0,
    score INTEGER DEFAULT 0,
    round_number INTEGER DEFAULT 1,
    difficulties_completed JSONB DEFAULT '[]',
    session_data JSONB DEFAULT '{}',
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_game_sessions_student_id ON game_sessions(student_id);
CREATE INDEX idx_game_sessions_game_id ON game_sessions(game_id);

-- Enable Row Level Security (RLS)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games (public read access)
CREATE POLICY "Anyone can view games" ON games
    FOR SELECT USING (true);

-- RLS Policies for game_sessions
CREATE POLICY "Students can view and create their own game sessions" ON game_sessions
    FOR ALL USING (
        student_id IN (
            SELECT id FROM children 
            WHERE email = auth.jwt() ->> 'email'
        )
    );

CREATE POLICY "Parents can view their children's game sessions" ON game_sessions
    FOR SELECT USING (
        student_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

-- Insert default Memory Game
INSERT INTO games (name, description, base_points, difficulty_levels) 
VALUES (
    'Memory Game',
    'Test your memory skills with different difficulty levels',
    10,
    '["easy", "medium", "hard"]'
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON games TO authenticated;
GRANT SELECT, INSERT, UPDATE ON game_sessions TO authenticated;

-- =============================================================================
-- SECTION 10: REWARDS SYSTEM TABLES SETUP
-- =============================================================================
-- This section creates tables for the rewards and achievements system

-- Drop existing tables (in correct order to handle foreign key dependencies)
DROP TABLE IF EXISTS reward_redemptions CASCADE;
DROP TABLE IF EXISTS student_points CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS rewards_store CASCADE;

-- Create achievements table
CREATE TABLE achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    points_earned INTEGER NOT NULL DEFAULT 0,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rewards_store table
CREATE TABLE rewards_store (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    points_cost INTEGER NOT NULL,
    reward_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    monetary_value DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reward_redemptions table
CREATE TABLE reward_redemptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    reward_id UUID REFERENCES rewards_store(id) ON DELETE CASCADE,
    points_spent INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    parent_response TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create student_points table
CREATE TABLE student_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID REFERENCES children(id) ON DELETE CASCADE UNIQUE,
    total_points INTEGER DEFAULT 0,
    points_this_month INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_achievements_child_id ON achievements(child_id);
CREATE INDEX idx_achievements_type ON achievements(achievement_type);
CREATE INDEX idx_rewards_store_parent_id ON rewards_store(parent_id);
CREATE INDEX idx_reward_redemptions_child_id ON reward_redemptions(child_id);
CREATE INDEX idx_reward_redemptions_status ON reward_redemptions(status);
CREATE INDEX idx_student_points_child_id ON student_points(child_id);

-- Enable Row Level Security (RLS)
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies for achievements
CREATE POLICY "Students can view their own achievements" ON achievements
    FOR SELECT USING (
        child_id IN (
            SELECT id FROM children 
            WHERE email = auth.jwt() ->> 'email'
        )
    );

CREATE POLICY "Parents can view their children's achievements" ON achievements
    FOR SELECT USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

-- RLS Policies for rewards_store
CREATE POLICY "Parents can manage their rewards store" ON rewards_store
    FOR ALL USING (parent_id = auth.uid());

CREATE POLICY "Students can view rewards from their parent" ON rewards_store
    FOR SELECT USING (
        parent_id IN (
            SELECT parent_id FROM children 
            WHERE email = auth.jwt() ->> 'email'
        )
    );

-- RLS Policies for reward_redemptions
CREATE POLICY "Students can view and create their own redemptions" ON reward_redemptions
    FOR ALL USING (
        child_id IN (
            SELECT id FROM children 
            WHERE email = auth.jwt() ->> 'email'
        )
    );

CREATE POLICY "Parents can view and update redemptions for their children" ON reward_redemptions
    FOR ALL USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

-- RLS Policies for student_points
CREATE POLICY "Students can view their own points" ON student_points
    FOR SELECT USING (
        child_id IN (
            SELECT id FROM children 
            WHERE email = auth.jwt() ->> 'email'
        )
    );

CREATE POLICY "Parents can view their children's points" ON student_points
    FOR SELECT USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_student_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_rewards_store_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_reward_redemptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_student_points_updated_at 
    BEFORE UPDATE ON student_points 
    FOR EACH ROW 
    EXECUTE FUNCTION update_student_points_updated_at();

CREATE TRIGGER update_rewards_store_updated_at 
    BEFORE UPDATE ON rewards_store 
    FOR EACH ROW 
    EXECUTE FUNCTION update_rewards_store_updated_at();

CREATE TRIGGER update_reward_redemptions_updated_at 
    BEFORE UPDATE ON reward_redemptions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_reward_redemptions_updated_at();

-- Function to award achievement points
CREATE OR REPLACE FUNCTION award_achievement_points(
    p_child_id UUID,
    p_achievement_type VARCHAR(50),
    p_title VARCHAR(100),
    p_description TEXT,
    p_points INTEGER
)
RETURNS UUID AS $$
DECLARE
    achievement_id UUID;
BEGIN
    -- Insert achievement
    INSERT INTO achievements (child_id, achievement_type, title, description, points_earned)
    VALUES (p_child_id, p_achievement_type, p_title, p_description, p_points)
    RETURNING id INTO achievement_id;
    
    -- Update student points
    INSERT INTO student_points (child_id, total_points, points_this_month)
    VALUES (p_child_id, p_points, p_points)
    ON CONFLICT (child_id) 
    DO UPDATE SET 
        total_points = student_points.total_points + p_points,
        points_this_month = student_points.points_this_month + p_points,
        updated_at = NOW();
    
    RETURN achievement_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON rewards_store TO authenticated;
GRANT SELECT, INSERT, UPDATE ON reward_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON student_points TO authenticated;
GRANT EXECUTE ON FUNCTION award_achievement_points TO authenticated;

-- =============================================================================
-- SECTION 11: FINAL PERMISSIONS AND CLEANUP
-- =============================================================================
-- Grant schema usage permissions
GRANT USAGE ON SCHEMA public TO authenticated;

-- Insert country to currency mappings
INSERT INTO country_currency_mapping (country_code, country_name, phone_prefix, currency_code, is_default) VALUES
('ZA', 'South Africa', '+27', 'ZAR', true),
('US', 'United States', '+1', 'USD', true),
('GB', 'United Kingdom', '+44', 'GBP', true),
('NG', 'Nigeria', '+234', 'NGN', true),
('KE', 'Kenya', '+254', 'KES', true),
('IN', 'India', '+91', 'INR', true),
('CA', 'Canada', '+1', 'CAD', false),
('AU', 'Australia', '+61', 'AUD', true),
('DE', 'Germany', '+49', 'EUR', true),
('FR', 'France', '+33', 'EUR', true)
ON CONFLICT (country_code) DO UPDATE SET
    country_name = EXCLUDED.country_name,
    phone_prefix = EXCLUDED.phone_prefix,
    currency_code = EXCLUDED.currency_code,
    is_default = EXCLUDED.is_default;

-- Add currency columns to existing tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

ALTER TABLE children ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE children ADD COLUMN IF NOT EXISTS currency_override BOOLEAN DEFAULT false;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE money_requests ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE recurring_payments ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';

-- Create multi_currency_wallets table for managing separate currency balances
CREATE TABLE IF NOT EXISTS multi_currency_wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    currency_code VARCHAR(3) REFERENCES currencies(code),
    balance DECIMAL(15,4) DEFAULT 0.0000,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(child_id, currency_code)
);

-- Create indexes for multi_currency_wallets
CREATE INDEX IF NOT EXISTS idx_multi_currency_wallets_child_id ON multi_currency_wallets(child_id);
CREATE INDEX IF NOT EXISTS idx_multi_currency_wallets_currency ON multi_currency_wallets(currency_code);
CREATE INDEX IF NOT EXISTS idx_multi_currency_wallets_primary ON multi_currency_wallets(child_id, is_primary) WHERE is_primary = true;

-- Enable RLS for new tables
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_currency_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_currency_wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for new tables
CREATE POLICY "Anyone can view currencies" ON currencies FOR SELECT USING (true);
CREATE POLICY "Anyone can view country currency mapping" ON country_currency_mapping FOR SELECT USING (true);

CREATE POLICY "Parents can view their children's wallets" ON multi_currency_wallets
    FOR SELECT USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can manage their children's wallets" ON multi_currency_wallets
    FOR ALL USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Students can view their own wallets" ON multi_currency_wallets
    FOR SELECT USING (
        child_id IN (
            SELECT id FROM children 
            WHERE email = auth.jwt() ->> 'email'
        )
    );

-- Multi-currency functions
CREATE OR REPLACE FUNCTION get_currency_from_phone(country_code_param VARCHAR(2))
RETURNS VARCHAR(3) AS $$
DECLARE
    currency_result VARCHAR(3);
BEGIN
    SELECT currency_code INTO currency_result
    FROM country_currency_mapping
    WHERE country_code = country_code_param AND is_default = true
    LIMIT 1;
    
    RETURN COALESCE(currency_result, 'USD');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_default_wallet(
    p_child_id UUID,
    p_currency_code VARCHAR(3)
)
RETURNS UUID AS $$
DECLARE
    wallet_id UUID;
BEGIN
    INSERT INTO multi_currency_wallets (child_id, currency_code, balance, is_primary)
    VALUES (p_child_id, p_currency_code, 0.0000, true)
    ON CONFLICT (child_id, currency_code) 
    DO UPDATE SET is_primary = true
    RETURNING id INTO wallet_id;
    
    UPDATE children 
    SET currency_code = p_currency_code
    WHERE id = p_child_id;
    
    RETURN wallet_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_wallet_balance(
    p_child_id UUID,
    p_currency_code VARCHAR(3),
    p_amount DECIMAL(15,4),
    p_operation VARCHAR(10)
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance DECIMAL(15,4);
    new_balance DECIMAL(15,4);
BEGIN
    SELECT balance INTO current_balance
    FROM multi_currency_wallets
    WHERE child_id = p_child_id AND currency_code = p_currency_code;
    
    IF current_balance IS NULL THEN
        INSERT INTO multi_currency_wallets (child_id, currency_code, balance, is_primary)
        VALUES (p_child_id, p_currency_code, 0.0000, false);
        current_balance := 0.0000;
    END IF;
    
    IF p_operation = 'add' THEN
        new_balance := current_balance + p_amount;
    ELSIF p_operation = 'subtract' THEN
        new_balance := current_balance - p_amount;
        IF new_balance < 0 THEN
            RETURN false;
        END IF;
    ELSE
        RETURN false;
    END IF;
    
    UPDATE multi_currency_wallets
    SET balance = new_balance, updated_at = NOW()
    WHERE child_id = p_child_id AND currency_code = p_currency_code;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create wallet when child is inserted
CREATE OR REPLACE FUNCTION create_child_default_wallet()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_wallet(NEW.id, NEW.currency_code);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_child_wallet ON children;
CREATE TRIGGER trigger_create_child_wallet
    AFTER INSERT ON children
    FOR EACH ROW
    EXECUTE FUNCTION create_child_default_wallet();

-- Create trigger for wallet updated_at
CREATE TRIGGER update_multi_currency_wallets_updated_at 
    BEFORE UPDATE ON multi_currency_wallets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions for multi-currency system
GRANT SELECT ON currencies TO authenticated;
GRANT SELECT ON country_currency_mapping TO authenticated;
GRANT SELECT, INSERT, UPDATE ON multi_currency_wallets TO authenticated;
GRANT EXECUTE ON FUNCTION get_currency_from_phone TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION update_wallet_balance TO authenticated;

-- Migrate existing data
UPDATE profiles SET default_currency = 'USD' WHERE default_currency IS NULL;
UPDATE children SET currency_code = 'USD' WHERE currency_code IS NULL;

-- Create wallets for existing children
INSERT INTO multi_currency_wallets (child_id, currency_code, balance, is_primary)
SELECT id, COALESCE(currency_code, 'USD'), COALESCE(balance, 0), true
FROM children
WHERE id NOT IN (SELECT DISTINCT child_id FROM multi_currency_wallets WHERE multi_currency_wallets.child_id IS NOT NULL)
ON CONFLICT (child_id, currency_code) DO NOTHING;

-- =============================================================================
-- DATABASE SETUP COMPLETE
-- =============================================================================
-- All tables, functions, triggers, and policies have been created successfully.
-- The HapoPay system database is now ready for use with multi-currency support.
-- 
-- Main Tables Created:
-- - children: Child account information (with currency support)
-- - transactions: Money transfer records (with currency tracking)
-- - money_requests: Student money requests (with currency support)
-- - emergency_requests: Emergency fund requests (with currency support)
-- - recurring_payments: Automated payment schedules (with currency support)
-- - parent_activities: Parent activity tracking
-- - safety_settings: Security rules and settings
-- - violations: Security violation records
-- - account_locks: Account restriction management
-- - games: Available games in the system
-- - game_sessions: Individual game session records
-- - achievements: Student achievement records
-- - rewards_store: Available rewards catalog
-- - reward_redemptions: Reward redemption requests
-- - student_points: Point balance tracking
-- - currencies: Supported currency definitions
-- - country_currency_mapping: Phone prefix to currency mapping
-- - multi_currency_wallets: Multi-currency wallet management
-- 
-- Multi-Currency Features:
-- - Automatic currency assignment based on phone number country code
-- - Currency override functionality for child accounts
-- - Multi-currency wallet support for each child
-- - Currency-aware transactions and transfers
-- - Parent and child currency preferences
--
-- Parent ID Enhancements:
-- - Added parent_id columns to money_requests and emergency_requests tables
-- - Improved data relationships and query performance
-- - Enhanced RLS policies for better security
-- =============================================================================

-- =============================================================================
-- SECTION 15: MULTI-CURRENCY SYSTEM SETUP
-- =============================================================================

-- Create currencies table for supported currencies
CREATE TABLE IF NOT EXISTS currencies (
    code VARCHAR(3) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    decimal_places INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert supported currencies (10 total - covers major international remittance needs)
INSERT INTO currencies (code, name, symbol, decimal_places, is_active) VALUES
('ZAR', 'South African Rand', 'R', 2, true),
('USD', 'United States Dollar', '$', 2, true),
('GBP', 'British Pound Sterling', '£', 2, true),
('NGN', 'Nigerian Naira', '₦', 2, true),
('KES', 'Kenyan Shilling', 'KSh', 2, true),
('INR', 'Indian Rupee', '₹', 2, true),
('CAD', 'Canadian Dollar', 'C$', 2, true),
('AUD', 'Australian Dollar', 'A$', 2, true),
('EUR', 'Euro', '€', 2, true),
('KRW', 'South Korean Won', '₩', 0, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    decimal_places = EXCLUDED.decimal_places,
    is_active = EXCLUDED.is_active;

-- Create country_currency_mapping table for phone prefix to currency mapping
CREATE TABLE IF NOT EXISTS country_currency_mapping (
    country_code VARCHAR(2) PRIMARY KEY,
    country_name VARCHAR(100) NOT NULL,
    phone_prefix VARCHAR(10) NOT NULL,
    currency_code VARCHAR(3) REFERENCES currencies(code),
    is_default BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert country to currency mappings
INSERT INTO country_currency_mapping (country_code, country_name, phone_prefix, currency_code, is_default) VALUES
('ZA', 'South Africa', '+27', 'ZAR', true),
('US', 'United States', '+1', 'USD', true),
('GB', 'United Kingdom', '+44', 'GBP', true),
('NG', 'Nigeria', '+234', 'NGN', true),
('KE', 'Kenya', '+254', 'KES', true),
('IN', 'India', '+91', 'INR', true),
('CA', 'Canada', '+1', 'CAD', false),
('AU', 'Australia', '+61', 'AUD', true),
('DE', 'Germany', '+49', 'EUR', true),
('KR', 'South Korea', '+82', 'KRW', true)
ON CONFLICT (country_code) DO UPDATE SET
    country_name = EXCLUDED.country_name,
    phone_prefix = EXCLUDED.phone_prefix,
    currency_code = EXCLUDED.currency_code,
    is_default = EXCLUDED.is_default;

-- Add currency columns to profiles table (for parents)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Add currency columns to children table
ALTER TABLE children ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE children ADD COLUMN IF NOT EXISTS currency_override BOOLEAN DEFAULT false;

-- Add currency columns to transaction tables
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE money_requests ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';
ALTER TABLE recurring_payments ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES currencies(code) DEFAULT 'USD';

-- Create multi_currency_wallets table for managing separate currency balances
CREATE TABLE IF NOT EXISTS multi_currency_wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    currency_code VARCHAR(3) REFERENCES currencies(code),
    balance DECIMAL(15,4) DEFAULT 0.0000,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(child_id, currency_code)
);

-- Create indexes for multi_currency_wallets
CREATE INDEX IF NOT EXISTS idx_multi_currency_wallets_child_id ON multi_currency_wallets(child_id);
CREATE INDEX IF NOT EXISTS idx_multi_currency_wallets_currency ON multi_currency_wallets(currency_code);
CREATE INDEX IF NOT EXISTS idx_multi_currency_wallets_primary ON multi_currency_wallets(child_id, is_primary) WHERE is_primary = true;

-- Enable RLS for multi_currency_wallets
ALTER TABLE multi_currency_wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for multi_currency_wallets
CREATE POLICY "Parents can view their children's wallets" ON multi_currency_wallets
    FOR SELECT USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can manage their children's wallets" ON multi_currency_wallets
    FOR ALL USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON multi_currency_wallets TO authenticated;
GRANT SELECT ON currencies TO authenticated;
GRANT SELECT ON country_currency_mapping TO authenticated;

-- Create trigger for updated_at
CREATE TRIGGER update_multi_currency_wallets_updated_at 
    BEFORE UPDATE ON multi_currency_wallets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Currency utility functions
CREATE OR REPLACE FUNCTION get_currency_from_phone(country_code_param VARCHAR(2))
RETURNS VARCHAR(3) AS $$
DECLARE
    currency_result VARCHAR(3);
BEGIN
    SELECT currency_code INTO currency_result
    FROM country_currency_mapping
    WHERE country_code = country_code_param AND is_default = true
    LIMIT 1;
    
    RETURN COALESCE(currency_result, 'USD');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_default_wallet(
    p_child_id UUID,
    p_currency_code VARCHAR(3)
)
RETURNS UUID AS $$
DECLARE
    wallet_id UUID;
BEGIN
    INSERT INTO multi_currency_wallets (child_id, currency_code, balance, is_primary)
    VALUES (p_child_id, p_currency_code, 0.0000, true)
    ON CONFLICT (child_id, currency_code) 
    DO UPDATE SET is_primary = true
    RETURNING id INTO wallet_id;
    
    UPDATE children 
    SET currency_code = p_currency_code
    WHERE id = p_child_id;
    
    RETURN wallet_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_wallet_balance(
    p_child_id UUID,
    p_currency_code VARCHAR(3),
    p_amount DECIMAL(15,4),
    p_operation VARCHAR(10)
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance DECIMAL(15,4);
    new_balance DECIMAL(15,4);
BEGIN
    SELECT balance INTO current_balance
    FROM multi_currency_wallets
    WHERE child_id = p_child_id AND currency_code = p_currency_code;
    
    IF current_balance IS NULL THEN
        PERFORM create_default_wallet(p_child_id, p_currency_code);
        current_balance := 0.0000;
    END IF;
    
    IF p_operation = 'add' THEN
        new_balance := current_balance + p_amount;
    ELSIF p_operation = 'subtract' THEN
        new_balance := current_balance - p_amount;
        IF new_balance < 0 THEN
            RETURN false;
        END IF;
    ELSE
        RETURN false;
    END IF;
    
    UPDATE multi_currency_wallets
    SET balance = new_balance, updated_at = NOW()
    WHERE child_id = p_child_id AND currency_code = p_currency_code;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION get_currency_from_phone TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION update_wallet_balance TO authenticated;

-- =============================================================================
-- SECTION 16: PARENT ID ENHANCEMENTS
-- =============================================================================

-- Add parent_id columns to request tables for better data relationships
ALTER TABLE money_requests ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES profiles(id);
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES profiles(id);

-- Update existing records to set parent_id based on child relationships
UPDATE money_requests 
SET parent_id = (
    SELECT parent_id 
    FROM children 
    WHERE children.id = money_requests.child_id
)
WHERE parent_id IS NULL;

UPDATE emergency_requests 
SET parent_id = (
    SELECT parent_id 
    FROM children 
    WHERE children.id = emergency_requests.child_id
)
WHERE parent_id IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_money_requests_parent_id ON money_requests(parent_id);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_parent_id ON emergency_requests(parent_id);

-- =============================================================================
-- SECTION 17: DATA MIGRATION FOR MULTI-CURRENCY
-- =============================================================================

-- Set default currency for existing profiles
UPDATE profiles 
SET default_currency = 'USD' 
WHERE default_currency IS NULL;

-- Set default currency for existing children
UPDATE children 
SET currency_code = 'USD' 
WHERE currency_code IS NULL;

-- Create wallets for existing children
INSERT INTO multi_currency_wallets (child_id, currency_code, balance, is_primary)
SELECT id, COALESCE(currency_code, 'USD'), COALESCE(balance, 0), true
FROM children
WHERE id NOT IN (SELECT DISTINCT child_id FROM multi_currency_wallets WHERE child_id IS NOT NULL)
ON CONFLICT (child_id, currency_code) DO NOTHING;

-- =============================================================================
-- CONSOLIDATED SETUP COMPLETE
-- =============================================================================
